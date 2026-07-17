import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaClient } from '@nexusos/database';
import { QUEUE_NAMES } from '@nexusos/events';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const enqueueSchema = z.object({
  agentId: z.string().min(1),
  taskType: z.string().min(1),
  input: z.record(z.unknown()),
});

export type EnqueueInput = z.infer<typeof enqueueSchema>;

@Injectable()
export class AgentRunsService {
  constructor(
    private readonly db: PrismaClient,
    @InjectQueue(QUEUE_NAMES.AGENT_RUNS) private readonly queue: Queue,
  ) {}

  async enqueue(orgId: string, input: EnqueueInput, initiatedById: string): Promise<string> {
    const parsed = enqueueSchema.parse(input);

    // Verify agent belongs to org and is active
    const agent = await this.db.agent.findFirst({
      where: { id: parsed.agentId, orgId, deletedAt: null, status: 'active' },
    });
    if (!agent) throw new NotFoundException('Agent not found or inactive');

    const run = await this.db.agentRun.create({
      data: {
        orgId,
        agentId: parsed.agentId,
        taskType: parsed.taskType,
        status: 'queued',
        input: parsed.input as never,
        initiatedById,
      },
    });

    await this.queue.add(
      { type: 'agent.run', orgId, agentRunId: run.id, agentId: parsed.agentId, taskType: parsed.taskType, input: parsed.input, initiatedById },
      { jobId: run.id, attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    return run.id;
  }

  async getStatus(orgId: string, runId: string) {
    const run = await this.db.agentRun.findFirst({
      where: { id: runId, orgId },
      include: {
        approval: {
          select: { id: true, status: true, requestedAction: true, riskLevel: true },
        },
      },
    });
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }

  async list(orgId: string, agentId?: string, limit = 20) {
    return this.db.agentRun.findMany({
      where: { orgId, ...(agentId ? { agentId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { approval: { select: { id: true, status: true } } },
    });
  }

  async cancel(orgId: string, runId: string, userId: string): Promise<void> {
    const run = await this.db.agentRun.findFirst({
      where: { id: runId, orgId, status: { in: ['queued', 'planning', 'awaiting_approval'] } },
    });
    if (!run) throw new NotFoundException('Run not found or cannot be cancelled');

    await this.db.agentRun.update({
      where: { id: runId },
      data: { status: 'cancelled' },
    });

    // Attempt to remove from queue if still waiting
    const job = await this.queue.getJob(runId);
    if (job) await job.remove();
  }
}
