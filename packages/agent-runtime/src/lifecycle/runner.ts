import type { PrismaClient } from '@nexusos/database';
import type { AiGateway } from '@nexusos/ai-core';
import type { AuditService } from '@nexusos/audit';
import type { ChatMessage, ToolDefinition as AiToolDefinition } from '@nexusos/types';
import { ToolRegistry, type ToolContext } from '../tools/registry.js';
import {
  AgentRunError,
  ApprovalRequiredError,
  ToolNotAllowedError,
  RunTimeoutError,
} from '../errors/index.js';

const MAX_TOOL_ITERATIONS = 10;
const DEFAULT_TIMEOUT_MS = 120_000;

export interface RunAgentInput {
  agentRunId: string;
  orgId: string;
  agentId: string;
  taskType: string;
  input: Record<string, unknown>;
  initiatedById: string;
}

export interface RunAgentResult {
  runId: string;
  status: 'completed' | 'awaiting_approval' | 'failed';
  output: Record<string, unknown> | null;
  approvalId: string | null;
  costUsd: number;
  durationMs: number;
}

export class AgentRunner {
  constructor(
    private readonly db: PrismaClient,
    private readonly gateway: AiGateway,
    private readonly registry: ToolRegistry,
    private readonly audit: AuditService,
  ) {}

  async run(jobInput: RunAgentInput): Promise<RunAgentResult> {
    const startMs = Date.now();

    // Mark run as executing
    await this.db.agentRun.update({
      where: { id: jobInput.agentRunId },
      data: { status: 'executing' },
    });

    try {
      const result = await this.executeWithTimeout(jobInput, DEFAULT_TIMEOUT_MS);

      // Persist completed run
      await this.db.agentRun.update({
        where: { id: jobInput.agentRunId },
        data: {
          status: result.status === 'awaiting_approval' ? 'awaiting_approval' : 'completed',
          output: result.output ?? {},
          costUsd: result.costUsd,
          durationMs: Date.now() - startMs,
        },
      });

      await this.audit.write({
        orgId: jobInput.orgId,
        actorId: jobInput.agentId,
        actorType: 'agent',
        action: 'agent.run.completed',
        resourceType: 'agent_run',
        resourceId: jobInput.agentRunId,
        payload: { status: result.status, costUsd: result.costUsd },
      });

      return { ...result, durationMs: Date.now() - startMs };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable = err instanceof AgentRunError ? err.retryable : false;

      await this.db.agentRun.update({
        where: { id: jobInput.agentRunId },
        data: {
          status: retryable ? 'retrying' : 'failed',
          errorMessage: message,
          durationMs: Date.now() - startMs,
        },
      });

      await this.audit.write({
        orgId: jobInput.orgId,
        actorId: jobInput.agentId,
        actorType: 'agent',
        action: 'agent.run.failed',
        resourceType: 'agent_run',
        resourceId: jobInput.agentRunId,
        payload: { error: message, retryable },
      });

      if (!retryable) {
        return {
          runId: jobInput.agentRunId,
          status: 'failed',
          output: { error: message },
          approvalId: null,
          costUsd: 0,
          durationMs: Date.now() - startMs,
        };
      }
      throw err;
    }
  }

  private async executeWithTimeout(
    jobInput: RunAgentInput,
    timeoutMs: number,
  ): Promise<RunAgentResult> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new RunTimeoutError(jobInput.agentRunId)), timeoutMs),
    );
    return Promise.race([this.executeAgent(jobInput), timeoutPromise]);
  }

  private async executeAgent(jobInput: RunAgentInput): Promise<RunAgentResult> {
    const agent = await this.db.agent.findFirst({
      where: { id: jobInput.agentId, orgId: jobInput.orgId, deletedAt: null },
    });
    if (!agent) throw new AgentRunError('Agent not found', 'AGENT_NOT_FOUND', jobInput.agentRunId);

    // Build the tool context passed into every tool handler
    const toolCtx: ToolContext = {
      orgId: jobInput.orgId,
      agentRunId: jobInput.agentRunId,
      agentId: jobInput.agentId,
      userId: jobInput.initiatedById,
    };

    // Resolve allowed tools for this agent
    const allowedTools = this.registry.getByNames(agent.allowedTools);

    // Convert to AI gateway tool format
    const aiTools: AiToolDefinition[] = allowedTools.map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      inputSchema: t.definition.inputSchema,
    }));

    // Build initial messages
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: agent.systemPrompt.replace('{orgName}', jobInput.orgId),
      },
      {
        role: 'user',
        content: this.buildUserMessage(jobInput.taskType, jobInput.input),
      },
    ];

    const toolCallRecords: Record<string, unknown>[] = [];
    let totalCostUsd = 0;
    let iterations = 0;

    // Agentic tool-use loop
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const response = await this.gateway.complete({
        provider: agent.modelProvider as 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama',
        model: agent.modelName,
        messages,
        tools: aiTools.length > 0 ? aiTools : undefined,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        orgId: jobInput.orgId,
        agentRunId: jobInput.agentRunId,
      });

      totalCostUsd += response.costUsd;

      // Update token usage on the run record
      await this.db.agentRun.update({
        where: { id: jobInput.agentRunId },
        data: {
          inputTokens: { increment: response.usage.inputTokens },
          outputTokens: { increment: response.usage.outputTokens },
          costUsd: { increment: response.costUsd },
        },
      });

      const { message, finishReason } = response;

      // Add assistant turn to history
      messages.push(message);

      // No tool calls — agent is done
      if (finishReason === 'stop' || !message.toolCalls || message.toolCalls.length === 0) {
        return {
          runId: jobInput.agentRunId,
          status: 'completed',
          output: { response: message.content },
          approvalId: null,
          costUsd: totalCostUsd,
          durationMs: 0,
        };
      }

      // Execute tool calls
      for (const toolCall of message.toolCalls) {
        const toolName = toolCall.function.name;
        const toolInput = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

        const registered = this.registry.get(toolName);
        if (!registered) {
          throw new ToolNotAllowedError(toolName, jobInput.agentRunId);
        }
        if (!agent.allowedTools.includes(toolName)) {
          throw new ToolNotAllowedError(toolName, jobInput.agentRunId);
        }

        // Check if this tool requires approval
        if (registered.definition.approvalPolicy === 'always') {
          const approval = await this.createApproval(jobInput, toolName, toolInput);
          throw new ApprovalRequiredError(jobInput.agentRunId, approval.id);
        }

        const callStart = Date.now();
        let toolOutput: unknown;
        let toolError: string | null = null;

        try {
          toolOutput = await registered.handler(toolInput, toolCtx);
        } catch (err: unknown) {
          toolError = err instanceof Error ? err.message : String(err);
          toolOutput = { error: toolError };
        }

        const callRecord = {
          id: toolCall.id,
          toolName,
          input: toolInput,
          output: toolOutput,
          durationMs: Date.now() - callStart,
          error: toolError,
          riskLevel: registered.definition.riskLevel,
          approvalRequired: false,
        };
        toolCallRecords.push(callRecord);

        if (registered.definition.auditRequired) {
          await this.audit.write({
            orgId: jobInput.orgId,
            actorId: jobInput.agentId,
            actorType: 'agent',
            action: 'agent.tool.called',
            resourceType: 'tool',
            resourceId: toolName,
            payload: { input: toolInput, output: toolOutput, runId: jobInput.agentRunId },
          });
        }

        // Add tool result back into message history
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolOutput),
          toolCallId: toolCall.id,
        });
      }
    }

    return {
      runId: jobInput.agentRunId,
      status: 'completed',
      output: { response: 'Max iterations reached', toolCallRecords },
      approvalId: null,
      costUsd: totalCostUsd,
      durationMs: 0,
    };
  }

  private buildUserMessage(taskType: string, input: Record<string, unknown>): string {
    switch (taskType) {
      case 'qualify_lead':
        return `Please qualify this lead and determine if they are a good fit.

Lead information:
${JSON.stringify(input, null, 2)}

Steps to complete:
1. Look up the contact in the CRM
2. Search the knowledge base for relevant qualification criteria
3. Evaluate the lead based on BANT (Budget, Authority, Need, Timeline)
4. Update the contact's lead status and score
5. Draft a personalized outreach email (requires approval before sending)
6. Log an activity summarizing your qualification decision`;

      case 'support_triage':
        return `Please triage this customer support request.

Request: ${JSON.stringify(input, null, 2)}

Steps:
1. Look up the customer in the CRM
2. Search the knowledge base for a relevant answer
3. Draft a response (requires approval if escalation is needed)
4. Update the ticket with your findings`;

      default:
        return `Task: ${taskType}\n\nContext:\n${JSON.stringify(input, null, 2)}`;
    }
  }

  private async createApproval(
    jobInput: RunAgentInput,
    toolName: string,
    toolInput: Record<string, unknown>,
  ) {
    const approval = await this.db.approval.create({
      data: {
        orgId: jobInput.orgId,
        agentRunId: jobInput.agentRunId,
        requestedAction: toolName,
        reason: `Agent requested to execute tool: ${toolName}`,
        expectedOutcome: `Tool will be called with the provided input`,
        dataInvolved: toolInput,
        riskLevel: 'medium',
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.write({
      orgId: jobInput.orgId,
      actorId: jobInput.agentId,
      actorType: 'agent',
      action: 'approval.requested',
      resourceType: 'approval',
      resourceId: approval.id,
      payload: { toolName, runId: jobInput.agentRunId },
    });

    return approval;
  }
}
