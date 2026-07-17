import type { ID, Timestamps } from './common.js';

export type PlanTier = 'starter' | 'professional' | 'business' | 'agency' | 'enterprise';

export type OrgStatus = 'active' | 'trial' | 'suspended' | 'cancelled';

export type Industry =
  | 'logistics'
  | 'moving'
  | 'medical_courier'
  | 'home_services'
  | 'real_estate'
  | 'nonprofit'
  | 'ecommerce'
  | 'agency'
  | 'professional_services'
  | 'other';

export interface Organization extends Timestamps {
  id: ID;
  name: string;
  slug: string;
  industry: Industry;
  plan: PlanTier;
  status: OrgStatus;
  ownerId: ID;
  parentOrgId: ID | null;
  logoUrl: string | null;
  domain: string | null;
  settings: OrgSettings;
}

export interface OrgSettings {
  timezone: string;
  currency: string;
  aiDefaultModel: string;
  monthlyAiBudgetUsd: number | null;
  requireApprovalForExternalEmail: boolean;
  requireApprovalForPayments: boolean;
  requireApprovalForRefunds: boolean;
  allowedAiProviders: string[];
  whitelabelEnabled: boolean;
  brandColor: string | null;
}
