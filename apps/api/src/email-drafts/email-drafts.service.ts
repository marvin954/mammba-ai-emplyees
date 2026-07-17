import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaClient } from '@nexusos/database';
import { QUEUE_NAMES } from '@nexusos/events';
import type { EmailSendJob } from '@nexusos/events';
import { z } from 'zod';

const createDraftSchema = z.object({
  toAddress: z.string().email(),
  ccAddress: z.string().email().optional(),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  bodyText: z.string().min(1),
  fromName: z.string().max(100).optional(),
  replyTo: z.string().email().optional(),
  agentRunId: z.string().optional(),
  agentId: z.string().optional(),
});

export type CreateDraftInput = z.infer<typeof createDraftSchema>;

@Injectable()
export class EmailDraftsService {
  constructor(
    private readonly db: PrismaClient,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  async create(orgId: string, input: CreateDraftInput) {
    const parsed = createDraftSchema.parse(input);
    return this.db.emailDraft.create({
      data: { ...parsed, orgId, status: 'draft' },
    });
  }

  async list(orgId: string, options: { status?: string; limit?: number; page?: number } = {}) {
    const { status, limit = 30, page = 1 } = options;
    const skip = (page - 1) * limit;
    const where = { orgId, ...(status ? { status } : {}) };

    const [data, total] = await Promise.all([
      this.db.emailDraft.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.db.emailDraft.count({ where }),
    ]);

    return { data, total, page, limit, hasMore: skip + limit < total };
  }

  async getById(orgId: string, draftId: string) {
    const draft = await this.db.emailDraft.findFirst({ where: { id: draftId, orgId } });
    if (!draft) throw new NotFoundException('Email draft not found');
    return draft;
  }

  /**
   * Submit draft for human approval.
   * Creates an Approval record and transitions draft to 'pending_approval'.
   * The ApprovalProcessor resumes the flow when the human decides.
   */
  async submitForApproval(orgId: string, draftId: string, requestedById: string) {
    const draft = await this.getById(orgId, draftId);
    if (draft.status !== 'draft') {
      throw new BadRequestException(`Draft is already ${draft.status}`);
    }

    // Create approval linked to this draft
    const approval = await this.db.approval.create({
      data: {
        orgId,
        agentRunId: draft.agentRunId ?? '',
        requestedAction: 'email.send',
        reason: `Send email to ${draft.toAddress}: ${draft.subject}`,
        expectedOutcome: 'Email delivered to recipient',
        dataInvolved: {
          to: draft.toAddress,
          subject: draft.subject,
          preview: draft.bodyText.slice(0, 200),
        } as never,
        riskLevel: 'medium',
        status: 'pending',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    await this.db.emailDraft.update({
      where: { id: draftId },
      data: { status: 'pending_approval', approvalId: approval.id },
    });

    return { draftId, approvalId: approval.id };
  }

  /**
   * Approve and send a draft immediately.
   * Called by: approval webhook handler OR a privileged API user (admin/owner).
   */
  async approveAndSend(orgId: string, draftId: string, reviewerId: string) {
    const draft = await this.getById(orgId, draftId);

    if (!['draft', 'pending_approval'].includes(draft.status)) {
      throw new BadRequestException(`Cannot approve draft with status: ${draft.status}`);
    }

    // Update draft status
    await this.db.emailDraft.update({
      where: { id: draftId },
      data: { status: 'approved' },
    });

    // Mark linked approval as approved if exists
    if (draft.approvalId) {
      await this.db.approval.update({
        where: { id: draft.approvalId },
        data: { status: 'approved', reviewerId, reviewedAt: new Date() },
      }).catch(() => {});
    }

    // Enqueue the send job
    const job: EmailSendJob = {
      type: 'email.send',
      orgId,
      agentRunId: draft.agentRunId ?? undefined,
      to: draft.toAddress,
      subject: draft.subject,
      bodyHtml: draft.bodyHtml,
      bodyText: draft.bodyText,
      fromName: draft.fromName ?? undefined,
    };

    await this.emailQueue.add(job, {
      jobId: `email-draft-${draftId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return { draftId, queued: true };
  }

  /**
   * Reject a draft — marks it rejected and the approval (if any).
   */
  async reject(orgId: string, draftId: string, reviewerId: string, reason?: string) {
    const draft = await this.getById(orgId, draftId);

    if (!['draft', 'pending_approval'].includes(draft.status)) {
      throw new BadRequestException(`Cannot reject draft with status: ${draft.status}`);
    }

    await this.db.emailDraft.update({
      where: { id: draftId },
      data: { status: 'rejected' },
    });

    if (draft.approvalId) {
      await this.db.approval.update({
        where: { id: draft.approvalId },
        data: {
          status: 'rejected',
          reviewerId,
          reviewedAt: new Date(),
          reviewNote: reason ?? null,
        },
      }).catch(() => {});
    }

    return { draftId, rejected: true };
  }
}
