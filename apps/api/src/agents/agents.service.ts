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
