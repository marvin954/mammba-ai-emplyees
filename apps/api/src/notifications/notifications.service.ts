import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

export type NotificationType =
  | 'approval_requested'
  | 'approval_decided'
  | 'agent_run_completed'
  | 'agent_run_failed'
  | 'email_draft_ready'
  | 'email_sent'
  | 'lead_enriched'
  | 'deal_stage_changed'
  | 'system';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly db: PrismaClient) {}

  async create(orgId: string, input: CreateNotificationInput) {
    return this.db.notification.create({
      data: {
        orgId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  }

  async list(
    orgId: string,
    userId: string,
    options: { unreadOnly?: boolean; limit?: number; page?: number } = {},
  ) {
    const { unreadOnly = false, limit = 30, page = 1 } = options;
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      userId,
      ...(unreadOnly ? { read: false } : {}),
    };

    const [data, total, unreadCount] = await Promise.all([
      this.db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.db.notification.count({ where }),
      this.db.notification.count({ where: { orgId, userId, read: false } }),
    ]);

    return { data, total, page, limit, hasMore: skip + limit < total, unreadCount };
  }

  async markRead(orgId: string, userId: string, notificationId: string) {
    return this.db.notification.updateMany({
      where: { id: notificationId, orgId, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(orgId: string, userId: string) {
    return this.db.notification.updateMany({
      where: { orgId, userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async getUnreadCount(orgId: string, userId: string) {
    return this.db.notification.count({ where: { orgId, userId, read: false } });
  }
}
