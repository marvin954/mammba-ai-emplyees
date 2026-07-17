import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

@Injectable()
export class ApprovalsService {
  constructor(private readonly db: PrismaClient) {}

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

    return this.db.approval.update({
      where: { id: approvalId },
      data: {
        status: 'approved',
        reviewerId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });
  }

  async reject(orgId: string, approvalId: string, reviewerId: string, note?: string) {
    await this.assertPending(orgId, approvalId);

    return this.db.approval.update({
      where: { id: approvalId },
      data: {
        status: 'rejected',
        reviewerId,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
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
