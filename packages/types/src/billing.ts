import type { ID, Timestamps } from './common.js';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid';

export interface Subscription extends Timestamps {
  id: ID;
  orgId: ID;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
  seats: number;
  cancelAtPeriodEnd: boolean;
}

export interface UsageRecord extends Timestamps {
  id: ID;
  orgId: ID;
  userId: ID | null;
  agentId: ID | null;
  resourceType: 'ai_tokens' | 'workflow_execution' | 'api_call' | 'storage_gb';
  quantity: number;
  unitCostUsd: number;
  totalCostUsd: number;
  provider: string | null;
  model: string | null;
  metadata: Record<string, unknown>;
}
