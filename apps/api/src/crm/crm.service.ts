import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import { z } from 'zod';

const createContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  companyId: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
});

const updateContactSchema = createContactSchema.partial();

const createDealSchema = z.object({
  name: z.string().min(1).max(200),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  pipelineId: z.string(),
  stageId: z.string(),
  value: z.number().min(0).default(0),
  currency: z.string().default('USD'),
  expectedCloseDate: z.string().datetime().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;

@Injectable()
export class CrmService {
  constructor(private readonly db: PrismaClient) {}

  // ─── Contacts ─────────────────────────────────────────────────────────────

  async createContact(orgId: string, input: CreateContactInput, createdById: string) {
    const parsed = createContactSchema.parse(input);
    return this.db.contact.create({
      data: {
        ...parsed,
        orgId,
        ownerId: createdById,
        tags: parsed.tags,
        customFields: parsed.customFields,
      },
    });
  }

  async listContacts(
    orgId: string,
    options: { page?: number; limit?: number; search?: string } = {},
  ) {
    const { page = 1, limit = 50, search } = options;
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.contact.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.db.contact.count({ where }),
    ]);

    return { data, total, page, limit, hasMore: skip + limit < total };
  }

  async getContact(orgId: string, contactId: string) {
    const contact = await this.db.contact.findFirst({
      where: { id: contactId, orgId, deletedAt: null },
      include: {
        company: true,
        deals: { where: { deletedAt: null } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async updateContact(orgId: string, contactId: string, input: UpdateContactInput) {
    await this.assertContact(orgId, contactId);
    const parsed = updateContactSchema.parse(input);
    return this.db.contact.update({
      where: { id: contactId },
      data: parsed,
    });
  }

  async deleteContact(orgId: string, contactId: string) {
    await this.assertContact(orgId, contactId);
    return this.db.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Deals ────────────────────────────────────────────────────────────────

  async createDeal(orgId: string, input: CreateDealInput, createdById: string) {
    const parsed = createDealSchema.parse(input);
    return this.db.deal.create({
      data: {
        ...parsed,
        orgId,
        ownerId: createdById,
        expectedCloseDate: parsed.expectedCloseDate ? new Date(parsed.expectedCloseDate) : null,
      },
    });
  }

  async listDeals(orgId: string, options: { pipelineId?: string; stageId?: string } = {}) {
    return this.db.deal.findMany({
      where: {
        orgId,
        deletedAt: null,
        ...(options.pipelineId ? { pipelineId: options.pipelineId } : {}),
        ...(options.stageId ? { stageId: options.stageId } : {}),
      },
      include: { contact: true, company: true, stage: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Activities ──────────────────────────────────────────────────────────

  async createActivity(
    orgId: string,
    input: {
      type: string;
      subject: string;
      body?: string;
      contactId?: string;
      dealId?: string;
      agentId?: string;
      agentRunId?: string;
      metadata?: Record<string, unknown>;
    },
    actorId: string | null,
  ) {
    return this.db.activity.create({
      data: {
        orgId,
        type: input.type,
        subject: input.subject,
        body: input.body ?? null,
        contactId: input.contactId ?? null,
        dealId: input.dealId ?? null,
        actorId,
        agentId: input.agentId ?? null,
        agentRunId: input.agentRunId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  }

  // ─── Pipelines ──────────────────────────────────────────────────────────

  async ensureDefaultPipeline(orgId: string) {
    const existing = await this.db.pipeline.findFirst({ where: { orgId, isDefault: true } });
    if (existing) return existing;

    return this.db.pipeline.create({
      data: {
        orgId,
        name: 'Sales Pipeline',
        isDefault: true,
        stages: {
          create: [
            { name: 'Lead', order: 1, probability: 10, color: '#94a3b8' },
            { name: 'Qualified', order: 2, probability: 30, color: '#60a5fa' },
            { name: 'Proposal', order: 3, probability: 60, color: '#a78bfa' },
            { name: 'Negotiation', order: 4, probability: 80, color: '#fb923c' },
            { name: 'Closed Won', order: 5, probability: 100, color: '#4ade80' },
            { name: 'Closed Lost', order: 6, probability: 0, color: '#f87171' },
          ],
        },
      },
      include: { stages: true },
    });
  }

  private async assertContact(orgId: string, contactId: string) {
    const contact = await this.db.contact.findFirst({
      where: { id: contactId, orgId, deletedAt: null },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }
}
