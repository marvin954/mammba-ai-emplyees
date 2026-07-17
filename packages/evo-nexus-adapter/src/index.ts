/**
 * EvoNexus Adapter
 *
 * EvoNexus is Anthropic's internal multi-agent operating layer exposed through
 * the Claude Agent SDK. This adapter wraps EvoNexus capabilities behind typed
 * contracts so the rest of NexusOS never depends directly on EvoNexus internals.
 *
 * Responsibilities:
 * - Translate NexusOS AgentRun requests into EvoNexus-compatible invocations
 * - Apply tenant-scoped tool restrictions before any execution
 * - Capture and normalise streaming events
 * - Map EvoNexus output back to NexusOS AgentRunResult shape
 * - Track model/token usage for billing
 *
 * Current implementation: The EvoNexus runtime is the Claude Agent SDK session
 * model (claude-sonnet-4-6). Provider calls are routed through packages/ai-core
 * which already wraps the Anthropic SDK. The adapter therefore acts as the
 * policy + context assembly layer sitting between the NexusOS agent lifecycle
 * and the ai-core gateway.
 */

import type { AiGateway } from '@nexusos/ai-core';
import type { ToolRegistry } from '@nexusos/agent-runtime';
import type { ChatMessage } from '@nexusos/types';

export interface EvoNexusRunInput {
  orgId: string;
  agentRunId: string;
  systemPrompt: string;
  messages: ChatMessage[];
  allowedToolNames: string[];
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface EvoNexusRunOutput {
  messages: ChatMessage[];
  totalCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

export class EvoNexusAdapter {
  constructor(
    private readonly gateway: AiGateway,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  /**
   * Execute a single turn through the EvoNexus / Claude runtime.
   * The AgentRunner lifecycle calls this to drive the agentic loop.
   */
  async execute(input: EvoNexusRunInput): Promise<EvoNexusRunOutput> {
    // Validate that all requested tools are registered and allowed
    const disallowed = input.allowedToolNames.filter(
      (name) => !this.toolRegistry.has(name),
    );
    if (disallowed.length > 0) {
      throw new Error(
        `EvoNexusAdapter: unregistered tools requested: ${disallowed.join(', ')}`,
      );
    }

    const tools = this.toolRegistry.getByNames(input.allowedToolNames).map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      inputSchema: t.definition.inputSchema,
    }));

    const allMessages: ChatMessage[] = [
      { role: 'system', content: input.systemPrompt },
      ...input.messages,
    ];

    const response = await this.gateway.complete({
      provider: 'anthropic',
      model: input.model,
      messages: allMessages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      orgId: input.orgId,
      agentRunId: input.agentRunId,
    });

    return {
      messages: [...input.messages, response.message],
      totalCostUsd: response.costUsd,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      finishReason: response.finishReason,
    };
  }

  /**
   * Returns the set of EvoNexus / NexusOS platform agent templates.
   * Used during marketplace install flow to seed agent configurations.
   */
  listPlatformAgentIds(): string[] {
    return [
      'tpl_sales_sdr',
      'tpl_exec_assistant',
      'tpl_customer_support',
      'tpl_marketing_manager',
      'tpl_operations_manager',
      'tpl_bookkeeping_assistant',
      'tpl_recruiter',
      'tpl_data_analyst',
    ];
  }
}
