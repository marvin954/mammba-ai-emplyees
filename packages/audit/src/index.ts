import type { PrismaClient } from '@nexusos/database';
import type { AuditAction } from '@nexusos/types';

export interface WriteAuditEventInput {
  orgId: string;
  actorId?: string | null;
  actorType?: 'user' | 'agent' | 'system' | 'webhook';
  action: AuditAction | string;
  resourceType: string;
  resourceId?: string | null;
  payload?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export class AuditService {
  constructor(private readonly db: PrismaClient) {}

  async write(input: WriteAuditEventInput): Promise<void> {
    await this.db.auditEvent.create({
      data: {
        orgId: input.orgId,
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? 'system',
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        payload: input.payload ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  }

  async list(orgId: string, options: { limit?: number; cursor?: string; action?: string } = {}) {
    const { limit = 50, cursor, action } = options;
    return this.db.auditEvent.findMany({
      where: {
        orgId,
        ...(action ? { action } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
