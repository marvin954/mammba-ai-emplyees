/**
 * Email send processor.
 *
 * Consumes EmailSendJob items from the EMAIL queue.
 * Every email routed through this processor has already passed human approval
 * (either the approval gate for agent-drafted emails, or explicit API calls
 * for system emails like invitations). This processor never decides on its
 * own whether to send — it only delivers what the queue says to send.
 */

import type { Job } from 'bullmq';
import type { PrismaClient } from '@nexusos/database';
import type { AuditService } from '@nexusos/audit';
import { EmailService } from '@nexusos/email';
import type { EmailSendJob } from '@nexusos/events';

export class EmailProcessor {
  private readonly email: EmailService;

  constructor(
    private readonly db: PrismaClient,
    private readonly audit: AuditService,
  ) {
    this.email = new EmailService({
      host: process.env['SMTP_HOST'] ?? 'localhost',
      port: Number(process.env['SMTP_PORT'] ?? 1025),
      secure: process.env['SMTP_SECURE'] === 'true',
      user: process.env['SMTP_USER'] || undefined,
      pass: process.env['SMTP_PASS'] || undefined,
      fromName: process.env['EMAIL_FROM_NAME'] ?? 'NexusOS',
      fromAddress: process.env['EMAIL_FROM'] ?? 'noreply@nexusos.local',
    });
  }

  async process(job: Job): Promise<void> {
    const data = job.data as EmailSendJob;

    if (data.type !== 'email.send') {
      throw new Error(`Unexpected job type in email queue: ${String(data.type)}`);
    }

    const result = await this.email.send({
      to: data.to,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      bodyText: data.bodyText,
      idempotencyKey: job.id,
    });

    // Update EmailDraft record if this was agent-drafted mail
    if (data.agentRunId) {
      await this.db.emailDraft
        .updateMany({
          where: { agentRunId: data.agentRunId, status: 'approved' },
          data: { status: 'sent', sentAt: new Date(), messageId: result.messageId },
        })
        .catch(() => {
          // Draft record may not exist for system emails — not an error
        });
    }

    await this.audit.write({
      orgId: data.orgId,
      action: 'email.sent',
      actorId: null,
      resourceType: 'email',
      resourceId: result.messageId,
      metadata: {
        to: data.to,
        subject: data.subject,
        accepted: result.accepted,
        rejected: result.rejected,
        agentRunId: data.agentRunId ?? null,
      },
    });

    if (result.rejected.length > 0) {
      console.warn(`[EmailProcessor] ${result.rejected.length} rejected recipients for job ${job.id}`);
    }
  }
}
