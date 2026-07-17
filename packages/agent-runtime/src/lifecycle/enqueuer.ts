import type { PrismaClient } from '@nexusos/database';
import type { AuditService } from '@nexusos/audit';

export interface EnqueueAgentRunInput {
  orgId: string;
  agentId: string;
  taskType: string;
  input: Record<string, unknown>;
  initiatedById: string;
  idempotencyKey?: string;
}

export interface QueueAdapter {
  enqueue(queueName: string, data: Record<string, unknown>, opts?: { jobId?: string }): Promise<string>;
}

export class AgentRunEnqueuer {
  constructor(
    private readonly db: PrismaClient,
    private readonly queue: QueueAdapter,
    private readonly audit: AuditService,
  ) {}

  async enqueue(input: EnqueueAgentRunInput): Promise<string> {
    // Verify the agent belongs to this org
    const agent = await this.db.agent.findFirst({
      where: { id: input.agentId, orgId: input.orgId, deletedAt: null, status: 'active' },
    });
    if (!agent) throw new Error(`Agent ${input.agentId} not found or inactive`);

    // Create the run record before enqueueing so we have an ID to reference
    const run = await this.db.agentRun.create({
      data: {
        orgId: input.orgId,
        agentId: input.agentId,
        taskType: input.taskType,
        status: 'queued',
        input: input.input,
        initiatedById: input.initiatedById,
      },
    });

    // Enqueue the job; idempotency key prevents double-processing
    await this.queue.enqueue(
      'agent-runs',
      {
        type: 'agent.run',
        orgId: input.orgId,
        agentRunId: run.id,
        agentId: input.agentId,
        taskType: input.taskType,
        input: input.input,
        initiatedById: input.initiatedById,
      },
      { jobId: input.idempotencyKey ?? run.id },
    );

    await this.audit.write({
      orgId: input.orgId,
      actorId: input.initiatedById,
      actorType: 'user',
      action: 'agent.run.started',
      resourceType: 'agent_run',
      resourceId: run.id,
      payload: { agentId: input.agentId, taskType: input.taskType },
    });

    return run.id;
  }
}
