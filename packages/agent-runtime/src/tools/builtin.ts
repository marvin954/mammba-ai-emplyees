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
