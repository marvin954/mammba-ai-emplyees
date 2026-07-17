import type { ID, RiskLevel, Timestamps } from './common.js';

export type AgentStatus = 'active' | 'inactive' | 'error';

export type AgentRunStatus =
  | 'queued'
  | 'planning'
  | 'awaiting_approval'
  | 'executing'
  | 'retrying'
  | 'completed'
  | 'partially_completed'
  | 'blocked'
  | 'failed'
  | 'cancelled';

export type ApprovalPolicy = 'never' | 'optional' | 'always';

export type AgentDepartment =
  | 'executive'
  | 'sales'
  | 'marketing'
  | 'support'
  | 'operations'
  | 'finance'
  | 'hr'
  | 'compliance'
  | 'research'
  | 'engineering';

export interface AgentTemplate {
  id: ID;
  name: string;
  role: string;
  description: string;
  department: AgentDepartment;
  capabilities: string[];
  defaultSystemPrompt: string;
  defaultModel: string;
  defaultTemperature: number;
  defaultTools: string[];
  requiredPlan: string;
  version: string;
}

export interface Agent extends Timestamps {
  id: ID;
  orgId: ID;
  templateId: ID;
  name: string;
  role: string;
  description: string;
  department: AgentDepartment;
  avatarUrl: string | null;
  systemPrompt: string;
  goals: string[];
  allowedTools: string[];
  prohibitedActions: string[];
  approvalPolicy: ApprovalPolicy;
  modelConfig: ModelConfig;
  status: AgentStatus;
  monthlyCostLimitUsd: number | null;
}

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama';
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptVersion: string;
}

export interface AgentRun extends Timestamps {
  id: ID;
  orgId: ID;
  agentId: ID;
  taskType: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
  toolCalls: ToolCallRecord[];
  usage: UsageSummary;
  costUsd: number;
  durationMs: number | null;
  approvalId: ID | null;
  initiatedBy: ID;
}

export interface ToolCallRecord {
  id: ID;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
  error: string | null;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
}

export interface UsageSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ApprovalRequest extends Timestamps {
  id: ID;
  orgId: ID;
  agentRunId: ID;
  requestedAction: string;
  reason: string;
  expectedOutcome: string;
  dataInvolved: Record<string, unknown>;
  estimatedCostUsd: number | null;
  riskLevel: RiskLevel;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewerId: ID | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
}
