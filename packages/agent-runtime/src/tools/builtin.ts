import type { PrismaClient } from '@nexusos/database';
import type { ToolRegistry } from './registry.js';

// Register the built-in tools available to all agents (subject to per-agent allowlists)
export function registerBuiltinTools(registry: ToolRegistry, db: PrismaClient): void {
  // ── CRM: read contact ──���─────────────────────────────────────────────────
  registry.register(
    {
      name: 'crm.contact.read',
      description: 'Look up a contact by ID or email address',
      inputSchema: {
        type: 'object',
        properties: {
          contactId: { type: 'string', description: 'Contact ID' },
          email: { type: 'string', description: 'Contact email address' },
        },
      },
      requiredPermission: 'crm.contact.read',
      riskLevel: 'low',
      approvalPolicy: 'never',
      idempotent: true,
      timeoutMs: 5000,
      auditRequired: false,
    },
    async (input, ctx) => {
      const { contactId, email } = input as { contactId?: string; email?: string };
      return db.contact.findFirst({
        where: {
          orgId: ctx.orgId,
          deletedAt: null,
          ...(contactId ? { id: contactId } : {}),
          ...(email ? { email } : {}),
        },
        include: { company: true },
      });
    },
  );

  // ── CRM: update contact ──────────────────────────────────────────────────
  registry.register(
    {
      name: 'crm.contact.update',
      description: 'Update contact fields (lead status, score, custom fields)',
      inputSchema: {
        type: 'object',
        required: ['contactId'],
        properties: {
          contactId: { type: 'string' },
          leadStatus: { type: 'string', enum: ['new', 'contacted', 'qualified', 'unqualified', 'converted'] },
          leadScore: { type: 'number', minimum: 0, maximum: 100 },
          tags: { type: 'array', items: { type: 'string' } },
          customFields: { type: 'object' },
        },
      },
      requiredPermission: 'crm.contact.update',
      riskLevel: 'low',
      approvalPolicy: 'never',
      idempotent: true,
      timeoutMs: 5000,
      auditRequired: true,
    },
    async (input, ctx) => {
      const { contactId, ...data } = input as {
        contactId: string;
        leadStatus?: string;
        leadScore?: number;
        tags?: string[];
        customFields?: Record<string, unknown>;
      };
      const contact = await db.contact.findFirst({
        where: { id: contactId, orgId: ctx.orgId, deletedAt: null },
      });
      if (!contact) throw new Error(`Contact ${contactId} not found in org ${ctx.orgId}`);
      return db.contact.update({ where: { id: contactId }, data });
    },
  );

  // ── CRM: create activity ─────────────────────────────────────────────────
  registry.register(
    {
      name: 'crm.activity.create',
      description: 'Log an activity (email, note, call, AI action) on a contact or deal',
      inputSchema: {
        type: 'object',
        required: ['type', 'subject'],
        properties: {
          type: { type: 'string', enum: ['email', 'call', 'note', 'ai_action', 'meeting'] },
          subject: { type: 'string' },
          body: { type: 'string' },
          contactId: { type: 'string' },
          dealId: { type: 'string' },
        },
      },
      requiredPermission: 'crm.contact.update',
      riskLevel: 'low',
      approvalPolicy: 'never',
      idempotent: false,
      timeoutMs: 5000,
      auditRequired: true,
    },
    async (input, ctx) => {
      const { type, subject, body, contactId, dealId } = input as {
        type: string;
        subject: string;
        body?: string;
        contactId?: string;
        dealId?: string;
      };
      return db.activity.create({
        data: {
          orgId: ctx.orgId,
          type,
          subject,
          body: body ?? null,
          contactId: contactId ?? null,
          dealId: dealId ?? null,
          agentId: ctx.agentId,
          agentRunId: ctx.agentRunId,
          actorId: null,
        },
      });
    },
  );

  // ── Email: draft (creates a draft, does NOT send — sending requires approval) ─
  registry.register(
    {
      name: 'email.draft',
      description: 'Create a draft email that a human must approve before sending',
      inputSchema: {
        type: 'object',
        required: ['to', 'subject', 'bodyText'],
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string' },
          bodyText: { type: 'string', description: 'Plain-text email body' },
          bodyHtml: { type: 'string', description: 'HTML email body (optional)' },
        },
      },
      requiredPermission: 'agent.run.create',
      riskLevel: 'medium',
      approvalPolicy: 'always',
      idempotent: false,
      timeoutMs: 3000,
      auditRequired: true,
    },
    async (input, _ctx) => {
      // Returns the draft — the caller (lifecycle) will gate on approvalPolicy = 'always'
      return { draft: input, status: 'pending_approval' };
    },
  );

  // ── Support: ticket read ─────────────────────────────────────────────────
  registry.register(
    {
      name: 'support.ticket.read',
      description: 'Look up a support ticket by ID or ticket number',
      inputSchema: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
          ticketNumber: { type: 'number' },
        },
      },
      requiredPermission: 'agent.run.create',
      riskLevel: 'low',
      approvalPolicy: 'never',
      idempotent: true,
      timeoutMs: 5000,
      auditRequired: false,
    },
    async (input, ctx) => {
      const { ticketId, ticketNumber } = input as { ticketId?: string; ticketNumber?: number };
      return db.supportTicket.findFirst({
        where: {
          orgId: ctx.orgId,
          ...(ticketId ? { id: ticketId } : {}),
          ...(ticketNumber ? { ticketNumber } : {}),
        },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } },
      });
    },
  );

  // ── Support: ticket update ────────────────────────────────────────────────
  registry.register(
    {
      name: 'support.ticket.update',
      description: 'Update a support ticket status, priority, or add an AI response message',
      inputSchema: {
        type: 'object',
        required: ['ticketId'],
        properties: {
          ticketId: { type: 'string' },
          status: { type: 'string', enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          replyBody: { type: 'string', description: 'AI-drafted reply to add as a message (requires approval)' },
        },
      },
      requiredPermission: 'agent.run.create',
      riskLevel: 'medium',
      approvalPolicy: 'optional',
      idempotent: false,
      timeoutMs: 5000,
      auditRequired: true,
    },
    async (input, ctx) => {
      const { ticketId, status, priority, replyBody } = input as {
        ticketId: string;
        status?: string;
        priority?: string;
        replyBody?: string;
      };

      const ticket = await db.supportTicket.findFirst({
        where: { id: ticketId, orgId: ctx.orgId },
      });
      if (!ticket) throw new Error(`Ticket ${ticketId} not found in org ${ctx.orgId}`);

      const updates: Record<string, unknown> = {};
      if (status) {
        updates.status = status;
        if (status === 'resolved') updates.resolvedAt = new Date();
        if (status === 'closed') updates.closedAt = new Date();
      }
      if (priority) updates.priority = priority;
      if (Object.keys(updates).length > 0) {
        await db.supportTicket.update({ where: { id: ticketId }, data: updates });
      }

      if (replyBody) {
        await db.ticketMessage.create({
          data: {
            ticketId,
            orgId: ctx.orgId,
            senderType: 'ai',
            senderId: ctx.agentId,
            body: replyBody,
          },
        });
      }

      return { ticketId, updated: true };
    },
  );

  // ── Marketing: campaign read ──────────────────────────────────────────────
  registry.register(
    {
      name: 'marketing.campaign.read',
      description: 'Read campaign details and assets',
      inputSchema: {
        type: 'object',
        required: ['campaignId'],
        properties: { campaignId: { type: 'string' } },
      },
      requiredPermission: 'agent.run.create',
      riskLevel: 'low',
      approvalPolicy: 'never',
      idempotent: true,
      timeoutMs: 5000,
      auditRequired: false,
    },
    async (input, ctx) => {
      const { campaignId } = input as { campaignId: string };
      return db.campaign.findFirst({
        where: { id: campaignId, orgId: ctx.orgId },
        include: { assets: true },
      });
    },
  );

  // ── Marketing: create asset ───────────────────────────────────────────────
  registry.register(
    {
      name: 'marketing.asset.create',
      description: 'Create a draft marketing asset (copy, post, email) attached to a campaign',
      inputSchema: {
        type: 'object',
        required: ['campaignId', 'type', 'name', 'content'],
        properties: {
          campaignId: { type: 'string' },
          type: { type: 'string', enum: ['email', 'social_post', 'ad_copy', 'landing_page'] },
          name: { type: 'string' },
          content: { type: 'string' },
        },
      },
      requiredPermission: 'agent.run.create',
      riskLevel: 'medium',
      approvalPolicy: 'always',
      idempotent: false,
      timeoutMs: 5000,
      auditRequired: true,
    },
    async (input, ctx) => {
      const { campaignId, type, name, content } = input as {
        campaignId: string;
        type: string;
        name: string;
        content: string;
      };
      const campaign = await db.campaign.findFirst({ where: { id: campaignId, orgId: ctx.orgId } });
      if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

      return db.campaignAsset.create({
        data: { campaignId, orgId: ctx.orgId, type, name, content, status: 'draft' },
      });
    },
  );

  // ── Finance: flag transaction ─────────────────────────────────────────────
  registry.register(
    {
      name: 'finance.transaction.flag',
      description: 'Flag a financial transaction for human review',
      inputSchema: {
        type: 'object',
        required: ['transactionId', 'reason'],
        properties: {
          transactionId: { type: 'string' },
          reason: { type: 'string' },
        },
      },
      requiredPermission: 'agent.run.create',
      riskLevel: 'low',
      approvalPolicy: 'never',
      idempotent: true,
      timeoutMs: 5000,
      auditRequired: true,
    },
    async (input, ctx) => {
      const { transactionId, reason } = input as { transactionId: string; reason: string };
      const tx = await db.financialTransaction.findFirst({
        where: { id: transactionId, orgId: ctx.orgId },
      });
      if (!tx) throw new Error(`Transaction ${transactionId} not found`);

      return db.financialTransaction.update({
        where: { id: transactionId },
        data: { flagged: true, flagReason: reason },
      });
    },
  );

  // ── Knowledge: search ────────────────────────────────────────────────────
  registry.register(
    {
      name: 'knowledge.search',
      description: 'Search the organization knowledge base for relevant information',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          limit: { type: 'number', default: 5 },
        },
      },
      requiredPermission: 'agent.run.create',
      riskLevel: 'low',
      approvalPolicy: 'never',
      idempotent: true,
      timeoutMs: 8000,
      auditRequired: false,
    },
    async (input, ctx) => {
      const { query, limit = 5 } = input as { query: string; limit?: number };
      // Perform basic text search until pgvector embeddings are wired in Phase 7
      return db.knowledgeChunk.findMany({
        where: {
          orgId: ctx.orgId,
          content: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        select: { id: true, content: true, metadata: true, sourceId: true },
      });
    },
  );
}
