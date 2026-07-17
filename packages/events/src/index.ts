// Typed domain events used across the platform
// Producers enqueue these; workers process them

export type AgentRunQueueJob = {
  type: 'agent.run';
  orgId: string;
  agentRunId: string;
  agentId: string;
  taskType: string;
  input: Record<string, unknown>;
  initiatedById: string;
};

export type ApprovalCompletedJob = {
  type: 'approval.completed';
  orgId: string;
  approvalId: string;
  agentRunId: string;
  decision: 'approved' | 'rejected';
  reviewerId: string;
};

export type WorkflowTriggerJob = {
  type: 'workflow.trigger';
  orgId: string;
  workflowId: string;
  agentRunId?: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
};

export type EmailSendJob = {
  type: 'email.send';
  orgId: string;
  agentRunId?: string;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  fromName?: string;
};

export type LeadEnrichJob = {
  type: 'lead.enrich';
  orgId: string;
  contactId: string;
  agentRunId: string;
  email: string;
  domain?: string;
};

export type QueueJob =
  | AgentRunQueueJob
  | ApprovalCompletedJob
  | WorkflowTriggerJob
  | EmailSendJob
  | LeadEnrichJob;

export const QUEUE_NAMES = {
  AGENT_RUNS: 'agent-runs',
  APPROVALS: 'approvals',
  WORKFLOWS: 'workflows',
  EMAIL: 'email',
  ENRICHMENT: 'enrichment',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
