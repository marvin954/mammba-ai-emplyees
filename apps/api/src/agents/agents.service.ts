import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

const PLATFORM_TEMPLATES = [
  {
    id: 'tpl_sales_sdr',
    name: 'Sales Development Representative',
    role: 'SDR',
    description: 'Qualifies leads, drafts personalized outreach, and books appointments.',
    department: 'sales',
    capabilities: ['lead_qualification', 'email_drafting', 'crm_updates', 'appointment_booking'],
    defaultSystemPrompt: `You are an expert Sales Development Representative working for {orgName}.
Your role is to qualify incoming leads, research prospects, and draft personalized outreach emails.

Guidelines:
- Always research the prospect before drafting outreach
- Personalize messages based on available context
- Focus on value, not features
- Never send emails without human approval
- Record all activities in the CRM

You are an AI assistant. Do not claim to be human if directly asked.`,
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.7,
    defaultTools: ['crm.contact.read', 'crm.contact.update', 'crm.activity.create', 'email.draft'],
    requiredPlan: 'starter',
    version: '1.0.0',
  },
  {
    id: 'tpl_exec_assistant',
    name: 'Executive Assistant',
    role: 'Executive Assistant',
    description: 'Manages calendar, drafts communications, and coordinates tasks.',
    department: 'executive',
    capabilities: ['calendar_management', 'email_drafting', 'task_coordination', 'research'],
    defaultSystemPrompt: `You are an expert Executive Assistant. You help manage communications, coordinate schedules, and keep track of priorities.

You are an AI assistant. Do not claim to be human if directly asked.`,
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.5,
    defaultTools: ['calendar.read', 'calendar.create', 'email.draft', 'task.create'],
    requiredPlan: 'starter',
    version: '1.0.0',
  },
  {
    id: 'tpl_customer_support',
    name: 'Customer Support Agent',
    role: 'Support Agent',
    description: 'Handles customer inquiries, drafts responses, and escalates complex issues.',
    department: 'support',
    capabilities: ['ticket_management', 'response_drafting', 'knowledge_retrieval', 'escalation'],
    defaultSystemPrompt: `You are a helpful and empathetic Customer Support Agent.
Your goal is to resolve customer issues efficiently and professionally.

Always:
- Acknowledge the customer's concern
- Search the knowledge base before responding
- Escalate complex issues to humans
- Disclose that you are an AI when asked directly`,
    defaultModel: 'claude-haiku-4-5-20251001',
    defaultTemperature: 0.5,
    defaultTools: ['crm.contact.read', 'knowledge.search', 'ticket.update'],
    requiredPlan: 'starter',
    version: '1.0.0',
  },
  {
    id: 'tpl_marketing_manager',
    name: 'Marketing Manager',
    role: 'Marketing Manager',
    description: 'Plans campaigns, drafts copy, analyses performance, and manages content calendar.',
    department: 'marketing',
    capabilities: ['campaign_planning', 'copy_drafting', 'analytics_review', 'content_scheduling'],
    defaultSystemPrompt: `You are an expert Marketing Manager for {orgName}.
You plan and execute marketing campaigns, write compelling copy, and analyse campaign performance.

Guidelines:
- Always align messaging with brand voice
- Base recommendations on data, not assumptions
- Draft all external-facing copy for human review before publishing
- Track all campaign activities in the CRM
- Disclose that you are an AI if directly asked`,
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.8,
    defaultTools: ['crm.contact.read', 'crm.activity.create', 'email.draft', 'knowledge.search'],
    requiredPlan: 'growth',
    version: '1.0.0',
  },
  {
    id: 'tpl_operations_manager',
    name: 'Operations Manager',
    role: 'Operations Manager',
    description: 'Monitors workflows, surfaces bottlenecks, and coordinates cross-team tasks.',
    department: 'operations',
    capabilities: ['workflow_monitoring', 'bottleneck_analysis', 'task_coordination', 'reporting'],
    defaultSystemPrompt: `You are an expert Operations Manager for {orgName}.
You monitor operational workflows, identify inefficiencies, and coordinate across departments.

Guidelines:
- Prioritise high-impact bottlenecks
- Always verify data before surfacing reports
- Escalate blockers to humans promptly
- Disclose that you are an AI if directly asked`,
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.4,
    defaultTools: ['crm.contact.read', 'crm.activity.create', 'knowledge.search'],
    requiredPlan: 'growth',
    version: '1.0.0',
  },
  {
    id: 'tpl_bookkeeping_assistant',
    name: 'Bookkeeping Assistant',
    role: 'Bookkeeping Assistant',
    description: 'Categorises transactions, flags anomalies, and prepares financial summaries.',
    department: 'finance',
    capabilities: ['transaction_categorisation', 'anomaly_detection', 'report_generation', 'reconciliation'],
    defaultSystemPrompt: `You are a careful and detail-oriented Bookkeeping Assistant for {orgName}.
You categorise financial transactions, flag anomalies, and prepare summaries for review.

Guidelines:
- Never make financial decisions autonomously
- Flag any transaction over $10,000 for human review
- Always present uncertainty clearly
- Do not access or share raw account credentials
- Disclose that you are an AI if directly asked`,
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.2,
    defaultTools: ['crm.activity.create', 'knowledge.search'],
    requiredPlan: 'growth',
    version: '1.0.0',
  },
  {
    id: 'tpl_recruiter',
    name: 'Recruiter',
    role: 'Recruiter',
    description: 'Sources candidates, screens applications, schedules interviews, and tracks pipeline.',
    department: 'hr',
    capabilities: ['candidate_sourcing', 'application_screening', 'interview_scheduling', 'pipeline_tracking'],
    defaultSystemPrompt: `You are a skilled Recruiter for {orgName}.
You source and screen candidates, coordinate interviews, and maintain the hiring pipeline.

Guidelines:
- Evaluate candidates based on skills and experience, never personal characteristics
- All outreach messages must be approved by a human before sending
- Respect candidate privacy — do not store sensitive personal data beyond what is needed
- Disclose that you are an AI if directly asked`,
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.6,
    defaultTools: ['crm.contact.read', 'crm.contact.update', 'crm.activity.create', 'email.draft'],
    requiredPlan: 'growth',
    version: '1.0.0',
  },
  {
    id: 'tpl_data_analyst',
    name: 'Data Analyst',
    role: 'Data Analyst',
    description: 'Queries data, builds reports, surfaces trends, and answers business questions.',
    department: 'analytics',
    capabilities: ['data_querying', 'report_generation', 'trend_analysis', 'visualisation_recommendations'],
    defaultSystemPrompt: `You are a rigorous Data Analyst for {orgName}.
You query business data, surface trends, and prepare clear reports for stakeholders.

Guidelines:
- Present findings with confidence intervals where appropriate
- Distinguish correlation from causation
- Source all numbers with references
- Never expose raw PII in reports
- Disclose that you are an AI if directly asked`,
    defaultModel: 'claude-sonnet-4-6',
    defaultTemperature: 0.3,
    defaultTools: ['crm.contact.read', 'knowledge.search', 'crm.activity.create'],
    requiredPlan: 'growth',
    version: '1.0.0',
  },
] as const;

@Injectable()
export class AgentsService {
  constructor(private readonly db: PrismaClient) {}

  async listTemplates() {
    return PLATFORM_TEMPLATES;
  }

  async installAgent(
    orgId: string,
    templateId: string,
    config: {
      name?: string;
      systemPrompt?: string;
      modelProvider?: string;
      modelName?: string;
    } = {},
    installedById: string,
  ) {
    const template = PLATFORM_TEMPLATES.find((t) => t.id === templateId);
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);

    return this.db.agent.create({
      data: {
        orgId,
        templateId,
        name: config.name ?? template.name,
        role: template.role,
        description: template.description,
        department: template.department,
        systemPrompt: config.systemPrompt ?? template.defaultSystemPrompt,
        goals: [],
        allowedTools: [...template.defaultTools],
        prohibitedActions: [],
        approvalPolicy: 'optional',
        modelProvider: config.modelProvider ?? 'anthropic',
        modelName: config.modelName ?? template.defaultModel,
        temperature: template.defaultTemperature,
        status: 'active',
      },
    });
  }

  async listAgents(orgId: string) {
    return this.db.agent.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAgent(orgId: string, agentId: string) {
    const agent = await this.db.agent.findFirst({
      where: { id: agentId, orgId, deletedAt: null },
      include: {
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async getRuns(orgId: string, agentId: string, limit = 20) {
    return this.db.agentRun.findMany({
      where: { orgId, agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
