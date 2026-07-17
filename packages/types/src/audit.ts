import type { ID } from './common.js';

export interface AuditEvent {
  id: ID;
  orgId: ID;
  actorId: ID | null;
  actorType: 'user' | 'agent' | 'system' | 'webhook';
  action: string;
  resourceType: string;
  resourceId: ID | null;
  payload: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
}

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.password_changed'
  | 'org.created'
  | 'org.updated'
  | 'member.invited'
  | 'member.removed'
  | 'agent.installed'
  | 'agent.run.started'
  | 'agent.run.completed'
  | 'agent.run.failed'
  | 'agent.tool.called'
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.rejected'
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'deal.created'
  | 'deal.updated'
  | 'deal.deleted'
  | 'email.sent'
  | 'workflow.executed'
  | 'credential.created'
  | 'credential.deleted'
  | 'billing.subscription_changed';
