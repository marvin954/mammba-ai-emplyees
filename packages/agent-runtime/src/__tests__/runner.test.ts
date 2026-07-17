import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from '../lifecycle/runner.js';
import { ToolRegistry } from '../tools/registry.js';
import { ToolNotAllowedError } from '../errors/index.js';

// ── minimal mocks ─────────────────────────────────────────────────────────────

function makeMockDb(agentOverrides: Record<string, unknown> = {}) {
  const agent = {
    id: 'agent-1',
    orgId: 'org-1',
    name: 'Test SDR',
    role: 'SDR',
    systemPrompt: 'You are a helpful assistant.',
    allowedTools: ['crm.contact.read'],
    modelProvider: 'anthropic',
    modelName: 'claude-sonnet-4-6',
    temperature: 0.7,
    maxTokens: 1024,
    deletedAt: null,
    status: 'active',
    ...agentOverrides,
  };

  return {
    agent: {
      findFirst: vi.fn().mockResolvedValue(agent),
    },
    agentRun: {
      update: vi.fn().mockResolvedValue({}),
    },
    approval: {
      create: vi.fn().mockResolvedValue({ id: 'appr-1' }),
    },
  };
}

function makeMockGateway(finishReason: string = 'stop', toolCalls?: unknown[]) {
  return {
    complete: vi.fn().mockResolvedValue({
      id: 'resp-1',
      model: 'claude-sonnet-4-6',
      message: {
        role: 'assistant',
        content: 'Lead looks promising.',
        toolCalls: toolCalls ?? undefined,
      },
      finishReason,
      usage: { inputTokens: 100, outputTokens: 50 },
      costUsd: 0.001,
    }),
  };
}

function makeMockAudit() {
  return { write: vi.fn().mockResolvedValue(undefined) };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AgentRunner', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register(
      {
        name: 'crm.contact.read',
        description: 'Read a contact',
        inputSchema: { type: 'object' },
        requiredPermission: 'crm.contact.read',
        riskLevel: 'low',
        approvalPolicy: 'never',
        idempotent: true,
        timeoutMs: 5000,
        auditRequired: false,
      },
      async () => ({ id: 'contact-1', email: 'test@example.com' }),
    );
  });

  it('completes a run when the model stops without tool calls', async () => {
    const db = makeMockDb();
    const gateway = makeMockGateway('stop');
    const audit = makeMockAudit();

    const runner = new AgentRunner(db as never, gateway as never, registry, audit as never);

    const result = await runner.run({
      agentRunId: 'run-1',
      orgId: 'org-1',
      agentId: 'agent-1',
      taskType: 'qualify_lead',
      input: { contactId: 'contact-1' },
      initiatedById: 'user-1',
    });

    expect(result.status).toBe('completed');
    expect(result.costUsd).toBeGreaterThan(0);
    expect(db.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('executes an allowed tool when the model requests it', async () => {
    const db = makeMockDb();
    // First response: tool call; second: stop
    const gateway = {
      complete: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'resp-1',
          model: 'claude-sonnet-4-6',
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: 'call-1',
                type: 'function',
                function: { name: 'crm.contact.read', arguments: '{"contactId":"contact-1"}' },
              },
            ],
          },
          finishReason: 'tool_calls',
          usage: { inputTokens: 80, outputTokens: 20 },
          costUsd: 0.0005,
        })
        .mockResolvedValueOnce({
          id: 'resp-2',
          model: 'claude-sonnet-4-6',
          message: { role: 'assistant', content: 'Done.' },
          finishReason: 'stop',
          usage: { inputTokens: 120, outputTokens: 30 },
          costUsd: 0.0008,
        }),
    };
    const audit = makeMockAudit();

    const runner = new AgentRunner(db as never, gateway as never, registry, audit as never);

    const result = await runner.run({
      agentRunId: 'run-2',
      orgId: 'org-1',
      agentId: 'agent-1',
      taskType: 'qualify_lead',
      input: { contactId: 'contact-1' },
      initiatedById: 'user-1',
    });

    expect(result.status).toBe('completed');
    expect(gateway.complete).toHaveBeenCalledTimes(2);
  });

  it('throws ToolNotAllowedError for a tool not in the allowlist', async () => {
    const db = makeMockDb({ allowedTools: [] }); // no tools allowed
    const gateway = {
      complete: vi.fn().mockResolvedValue({
        id: 'resp-1',
        model: 'claude-sonnet-4-6',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'crm.contact.read', arguments: '{}' },
            },
          ],
        },
        finishReason: 'tool_calls',
        usage: { inputTokens: 50, outputTokens: 10 },
        costUsd: 0.0003,
      }),
    };
    const audit = makeMockAudit();

    const runner = new AgentRunner(db as never, gateway as never, registry, audit as never);

    const result = await runner.run({
      agentRunId: 'run-3',
      orgId: 'org-1',
      agentId: 'agent-1',
      taskType: 'qualify_lead',
      input: {},
      initiatedById: 'user-1',
    });

    // Should fail (not retryable), not throw
    expect(result.status).toBe('failed');
  });

  it('creates approval and pauses for a tool with approvalPolicy=always', async () => {
    registry.register(
      {
        name: 'email.draft',
        description: 'Draft email',
        inputSchema: { type: 'object' },
        requiredPermission: 'agent.run.create',
        riskLevel: 'medium',
        approvalPolicy: 'always',
        idempotent: false,
        timeoutMs: 3000,
        auditRequired: true,
      },
      async () => ({ draft: 'email content' }),
    );

    const db = makeMockDb({ allowedTools: ['crm.contact.read', 'email.draft'] });
    const gateway = {
      complete: vi.fn().mockResolvedValue({
        id: 'resp-1',
        model: 'claude-sonnet-4-6',
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'email.draft', arguments: '{"to":"test@example.com","subject":"Hi","bodyText":"Hello"}' },
            },
          ],
        },
        finishReason: 'tool_calls',
        usage: { inputTokens: 60, outputTokens: 15 },
        costUsd: 0.0004,
      }),
    };
    const audit = makeMockAudit();

    const runner = new AgentRunner(db as never, gateway as never, registry, audit as never);

    const result = await runner.run({
      agentRunId: 'run-4',
      orgId: 'org-1',
      agentId: 'agent-1',
      taskType: 'qualify_lead',
      input: {},
      initiatedById: 'user-1',
    });

    expect(result.status).toBe('awaiting_approval');
    expect(db.approval.create).toHaveBeenCalled();
  });
});
