import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import { z } from 'zod';

const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(200).optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
});

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

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = Partial<CreateCompanyInput>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type CreateDealInput = z.infer<typeof createDealSchema>;

@Injectable()
export class CrmService {
  constructor(private readonly db: PrismaClient) {}

  // ─── Companies ────────────────────────────────────────────────────────────

  async createCompany(orgId: string, input: CreateCompanyInput, createdById: string) {
    const parsed = createCompanySchema.parse(input);
    return this.db.company.create({
      data: { ...parsed, orgId, ownerId: createdById } as never,
    });
  }

  async listCompanies(
    orgId: string,
    options: { page?: number; limit?: number; search?: string } = {},
  ) {
    const { page = 1, limit = 50, search } = options;
    const skip = (page - 1) * limit;
    const where = {
      orgId,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.company.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.db.company.count({ where }),
    ]);
    return { data, total, page, limit, hasMore: skip + limit < total };
  }

  async getCompany(orgId: string, companyId: string) {
    const company = await this.db.company.findFirst({
      where: { id: companyId, orgId, deletedAt: null },
      include: {
        contacts: { where: { deletedAt: null }, take: 50 },
        deals: { where: { deletedAt: null }, include: { stage: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompany(orgId: string, companyId: string, input: UpdateCompanyInput) {
    await this.assertCompany(orgId, companyId);
    const parsed = createCompanySchema.partial().parse(input);
    return this.db.company.update({ where: { id: companyId }, data: parsed as never });
  }

  async deleteCompany(orgId: string, companyId: string) {
    await this.assertCompany(orgId, companyId);
    return this.db.company.update({ where: { id: companyId }, data: { deletedAt: new Date() } });
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  async createContact(orgId: string, input: CreateContactInput, createdById: string) {
    const parsed = createContactSchema.parse(input);
    return this.db.contact.create({
      data: {
        ...parsed,
        orgId,
        ownerId: createdById,
        tags: parsed.tags,
        customFields: parsed.customFields as never,
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
      data: parsed as never,
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

  async moveDealToStage(
    orgId: string,
    dealId: string,
    stageId: string,
    actorId: string,
  ) {
    const deal = await this.db.deal.findFirst({
      where: { id: dealId, orgId, deletedAt: null },
      include: { stage: true },
    });
    if (!deal) throw new NotFoundException('Deal not found');

    const stage = await this.db.pipelineStage.findFirst({
      where: { id: stageId, pipelineId: deal.pipelineId },
    });
    if (!stage) throw new BadRequestException('Stage does not belong to this pipeline');

    const previousStageId = deal.stageId;
    const updated = await this.db.deal.update({
      where: { id: dealId },
      data: {
        stageId,
        status: stage.name === 'Closed Won' ? 'won' : stage.name === 'Closed Lost' ? 'lost' : 'open',
      },
      include: { stage: true },
    });

    await this.createActivity(orgId, {
      type: 'stage_change',
      subject: `Deal moved to ${stage.name}`,
      dealId,
      metadata: { previousStageId, newStageId: stageId },
    }, actorId);

    return updated;
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
        metadata: (input.metadata ?? {}) as never,
      },
    });
  }

  // ─── Pipelines ──────────────────────────────────────────────────────────

  async ensureDefaultPipeline(orgId: string) {
    const existing = await this.db.pipeline.findFirst({ where: { orgId, isDefault: true }, include: { stages: { orderBy: { order: 'asc' } } } });
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

  // ─── Activity feed ────────────────────────────────────────────────────────

  async listActivities(
    orgId: string,
    options: { contactId?: string; dealId?: string; page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 50, contactId, dealId } = options;
    const skip = (page - 1) * limit;
    const where = {
      orgId,
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.activity.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.db.activity.count({ where }),
    ]);
    return { data, total, page, limit, hasMore: skip + limit < total };
  }

  // ─── Lead scoring ─────────────────────────────────────────────────────────

  computeLeadScore(contact: {
    email?: string | null;
    phone?: string | null;
    companyId?: string | null;
    source?: string | null;
    activities?: unknown[];
  }): number {
    let score = 0;
    if (contact.email) score += 20;
    if (contact.phone) score += 15;
    if (contact.companyId) score += 20;
    if (contact.source === 'website') score += 10;
    else if (contact.source === 'referral') score += 25;
    else if (contact.source === 'inbound') score += 15;
    const activityCount = contact.activities?.length ?? 0;
    score += Math.min(activityCount * 5, 20);
    return Math.min(score, 100);
  }

  async refreshLeadScore(orgId: string, contactId: string) {
    const contact = await this.db.contact.findFirst({
      where: { id: contactId, orgId, deletedAt: null },
      include: { activities: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    const score = this.computeLeadScore(contact);
    return this.db.contact.update({ where: { id: contactId }, data: { leadScore: score } });
  }

  // ─── Lead submission (MVP vertical slice) ─────────────────────────────────
  // Creates a contact + deal, then returns both for the calling layer to
  // optionally enqueue an agent qualification run.

  async submitLead(
    orgId: string,
    input: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      companyName?: string;
      source?: string;
      customFields?: Record<string, unknown>;
    },
    createdById: string,
  ): Promise<{ contactId: string; dealId: string | null }> {
    // Upsert contact (deduplication by email within org)
    const existing = await this.db.contact.findFirst({
      where: { orgId, email: input.email, deletedAt: null },
    });

    const contact = existing
      ? existing
      : await this.db.contact.create({
          data: {
            orgId,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone ?? null,
            ownerId: createdById,
            source: input.source ?? 'manual',
            leadStatus: 'new',
            leadScore: 0,
            tags: [],
            customFields: (input.customFields ?? {}) as never,
          },
        });

    // Ensure a default pipeline exists
    const pipeline = await this.ensureDefaultPipeline(orgId);
    const firstStage = pipeline.stages[0];

    let dealId: string | null = null;
    if (firstStage) {
      const deal = await this.db.deal.create({
        data: {
          orgId,
          name: `${input.firstName} ${input.lastName} — Lead`,
          contactId: contact.id,
          pipelineId: pipeline.id,
          stageId: firstStage.id,
          status: 'open',
          value: 0,
          currency: 'USD',
          ownerId: createdById,
        },
      });
      dealId = deal.id;
    }

    return { contactId: contact.id, dealId };
  }

  private async assertCompany(orgId: string, companyId: string) {
    const company = await this.db.company.findFirst({
      where: { id: companyId, orgId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async assertContact(orgId: string, contactId: string) {
    const contact = await this.db.contact.findFirst({
      where: { id: contactId, orgId, deletedAt: null },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }
}
