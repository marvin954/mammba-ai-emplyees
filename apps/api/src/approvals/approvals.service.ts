import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaClient } from '@nexusos/database';
import { QUEUE_NAMES } from '@nexusos/events';
import type { ApprovalCompletedJob } from '@nexusos/events';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly db: PrismaClient,
    @InjectQueue(QUEUE_NAMES.APPROVALS) private readonly approvalsQueue: Queue,
  ) {}

  async list(orgId: string, options: { status?: string; limit?: number } = {}) {
    return this.db.approval.findMany({
      where: {
        orgId,
        ...(options.status ? { status: options.status } : {}),
      },
      include: {
        agentRun: { select: { agentId: true, taskType: true, input: true } },
        reviewer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
    });
  }

  async getById(orgId: string, approvalId: string) {
    const approval = await this.db.approval.findFirst({
      where: { id: approvalId, orgId },
      include: {
        agentRun: true,
        reviewer: { select: { id: true, name: true, email: true } },
      },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    return approval;
  }

  async approve(orgId: string, approvalId: string, reviewerId: string, note?: string) {
    const approval = await this.assertPending(orgId, approvalId);

    if (approval.expiresAt && approval.expiresAt < new Date()) {
      throw new BadRequestException('Approval has expired');
    }

    const updated = await this.db.approval.update({
      where: { id: approvalId },
      data: {
        status: 'approved',
        reviewerId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });

    await this.enqueueDecision(orgId, approvalId, approval.agentRunId, reviewerId, 'approved');

    return updated;
  }

  async reject(orgId: string, approvalId: string, reviewerId: string, note?: string) {
    const approval = await this.assertPending(orgId, approvalId);

    const updated = await this.db.approval.update({
      where: { id: approvalId },
      data: {
        status: 'rejected',
        reviewerId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });

    await this.enqueueDecision(orgId, approvalId, approval.agentRunId, reviewerId, 'rejected');

    return updated;
  }

  private async enqueueDecision(
    orgId: string,
    approvalId: string,
    agentRunId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
  ) {
    const payload: ApprovalCompletedJob = {
      type: 'approval.completed',
      orgId,
      approvalId,
      agentRunId,
      decision,
      reviewerId,
    };

    await this.approvalsQueue.add(payload, {
      jobId: `approval-${approvalId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  private async assertPending(orgId: string, approvalId: string) {
    const approval = await this.db.approval.findFirst({
      where: { id: approvalId, orgId },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== 'pending') {
      throw new BadRequestException(`Approval is already ${approval.status}`);
    }
    return approval;
  }
}
