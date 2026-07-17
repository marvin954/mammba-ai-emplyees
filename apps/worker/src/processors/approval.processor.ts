/**
 * Approval-completed processor.
 *
 * When a human approves or rejects a pending tool-call approval,
 * the API service enqueues an ApprovalCompletedJob here.
 *
 * On approval  — we re-enqueue the paused agent run so it can continue
 *                from the tool call that was gated.
 * On rejection — we mark the agent run as failed with a human-rejection reason
 *                and write an audit event.
 */

import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import type { PrismaClient } from '@nexusos/database';
import type { AuditService } from '@nexusos/audit';
import type { ApprovalCompletedJob, AgentRunQueueJob } from '@nexusos/events';
import { QUEUE_NAMES } from '@nexusos/events';

export class ApprovalProcessor {
  private readonly agentRunQueue: Queue;

  constructor(
    private readonly db: PrismaClient,
    private readonly audit: AuditService,
    redisConfig: { host: string; port: number; maxRetriesPerRequest: null },
  ) {
    this.agentRunQueue = new Queue(QUEUE_NAMES.AGENT_RUNS, { connection: redisConfig });
  }

  async process(job: Job): Promise<void> {
    const data = job.data as ApprovalCompletedJob;

    if (data.type !== 'approval.completed') {
      throw new Error(`Unexpected job type in approvals queue: ${String(data.type)}`);
    }

    const agentRun = await this.db.agentRun.findFirst({
      where: { id: data.agentRunId, orgId: data.orgId },
    });

    if (!agentRun) {
      console.warn(`[ApprovalProcessor] Agent run ${data.agentRunId} not found — skipping`);
      return;
    }

    if (data.decision === 'approved') {
      // Re-enqueue the agent run — the runner will pick up from where it paused.
      // We include the approvalId so the runner can skip the approval gate.
      const jobPayload: AgentRunQueueJob = {
        type: 'agent.run',
        orgId: data.orgId,
        agentRunId: data.agentRunId,
        agentId: agentRun.agentId,
        taskType: agentRun.taskType,
        input: { ...agentRun.input as Record<string, unknown>, _resumedFromApproval: data.approvalId },
        initiatedById: data.reviewerId,
      };

      await this.agentRunQueue.add('agent.run', jobPayload, {
        jobId: `resume-${data.agentRunId}-${data.approvalId}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      });

      await this.db.agentRun.update({
        where: { id: data.agentRunId },
        data: { status: 'queued' },
      });

      await this.audit.write({
        orgId: data.orgId,
        action: 'approval.resumed_run',
        actorId: data.reviewerId,
        resourceType: 'agent_run',
        resourceId: data.agentRunId,
        metadata: { approvalId: data.approvalId, decision: 'approved' },
      });
    } else {
      // Rejected — mark the run as failed
      await this.db.agentRun.update({
        where: { id: data.agentRunId },
        data: {
          status: 'failed',
          error: `Approval ${data.approvalId} was rejected by reviewer`,
          completedAt: new Date(),
        },
      });

      await this.audit.write({
        orgId: data.orgId,
        action: 'approval.rejected_run',
        actorId: data.reviewerId,
        resourceType: 'agent_run',
        resourceId: data.agentRunId,
        metadata: { approvalId: data.approvalId, decision: 'rejected' },
      });
    }
  }

  async close(): Promise<void> {
    await this.agentRunQueue.close();
  }
}
