import type { ID, Timestamps } from './common.js';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
export type DealStatus = 'open' | 'won' | 'lost' | 'on_hold';
export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'task' | 'ai_action';

export interface Contact extends Timestamps {
  id: ID;
  orgId: ID;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  companyId: ID | null;
  ownerId: ID | null;
  leadStatus: LeadStatus;
  leadScore: number;
  source: string | null;
  tags: string[];
  customFields: Record<string, unknown>;
}

export interface Company extends Timestamps {
  id: ID;
  orgId: ID;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  phone: string | null;
  address: string | null;
  ownerId: ID | null;
  tags: string[];
  customFields: Record<string, unknown>;
}

export interface Pipeline extends Timestamps {
  id: ID;
  orgId: ID;
  name: string;
  stages: PipelineStage[];
  isDefault: boolean;
}

export interface PipelineStage {
  id: ID;
  name: string;
  order: number;
  probability: number;
  color: string;
}

export interface Deal extends Timestamps {
  id: ID;
  orgId: ID;
  name: string;
  contactId: ID | null;
  companyId: ID | null;
  pipelineId: ID;
  stageId: ID;
  status: DealStatus;
  value: number;
  currency: string;
  expectedCloseDate: Date | null;
  ownerId: ID | null;
  tags: string[];
  customFields: Record<string, unknown>;
}

export interface Activity extends Timestamps {
  id: ID;
  orgId: ID;
  type: ActivityType;
  subject: string;
  body: string | null;
  contactId: ID | null;
  companyId: ID | null;
  dealId: ID | null;
  actorId: ID | null;
  agentId: ID | null;
  agentRunId: ID | null;
  metadata: Record<string, unknown>;
}
