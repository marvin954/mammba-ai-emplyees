import type { ID, Timestamps } from './common.js';

export type UserRole =
  | 'platform_owner'
  | 'platform_admin'
  | 'agency_owner'
  | 'org_owner'
  | 'org_admin'
  | 'manager'
  | 'member'
  | 'analyst'
  | 'billing_manager'
  | 'readonly'
  | 'client';

export interface User extends Timestamps {
  id: ID;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  status: 'active' | 'suspended' | 'deleted';
}

export interface Session {
  user: User;
  orgId: ID | null;
  role: UserRole;
  permissions: string[];
  expiresAt: Date;
}

export interface Membership extends Timestamps {
  id: ID;
  userId: ID;
  orgId: ID;
  role: UserRole;
  invitedBy: ID | null;
  acceptedAt: Date | null;
}

export interface Invitation extends Timestamps {
  id: ID;
  orgId: ID;
  email: string;
  role: UserRole;
  invitedBy: ID;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}

export type Permission =
  | 'crm.contact.read' | 'crm.contact.create' | 'crm.contact.update' | 'crm.contact.delete'
  | 'crm.deal.read' | 'crm.deal.create' | 'crm.deal.update' | 'crm.deal.delete'
  | 'agent.run.create' | 'agent.run.approve' | 'agent.run.cancel'
  | 'workflow.execute' | 'workflow.manage'
  | 'billing.manage' | 'billing.view'
  | 'credentials.manage'
  | 'audit.read'
  | 'org.manage'
  | 'team.manage';
