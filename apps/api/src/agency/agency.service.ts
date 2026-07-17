import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import { z } from 'zod';

const provisionOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  industry: z.string().default('other'),
  plan: z.enum(['starter', 'growth', 'enterprise']).default('starter'),
  whitelabelEnabled: z.boolean().default(false),
  customDomain: z.string().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export type ProvisionOrgInput = z.infer<typeof provisionOrgSchema>;

@Injectable()
export class AgencyService {
  constructor(private readonly db: PrismaClient) {}

  // ─── Verify agency role ──────────────────────────────────────────────────

  private async assertAgencyAdmin(agencyOrgId: string, userId: string) {
    const membership = await this.db.membership.findUnique({
      where: { userId_orgId: { userId, orgId: agencyOrgId } },
    });
    if (!membership || !['org_owner', 'org_admin'].includes(membership.role)) {
      throw new ForbiddenException('Agency admin access required');
    }
    const org = await this.db.organization.findUnique({ where: { id: agencyOrgId } });
    if (!org) throw new NotFoundException('Organization not found');
    // Agency mode requires enterprise plan
    if (org.plan !== 'enterprise') {
      throw new ForbiddenException('Agency mode requires the Enterprise plan');
    }
    return org;
  }

  // ─── Child org management ─────────────────────────────────────────────────

  async listChildOrgs(agencyOrgId: string, userId: string) {
    await this.assertAgencyAdmin(agencyOrgId, userId);
    return this.db.organization.findMany({
      where: { parentOrgId: agencyOrgId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, slug: true, industry: true, plan: true,
        status: true, createdAt: true, settings: true,
        _count: {
          select: {
            memberships: true,
            agents: true,
            agentRuns: true,
          },
        },
      },
    });
  }

  async getChildOrg(agencyOrgId: string, childOrgId: string, userId: string) {
    await this.assertAgencyAdmin(agencyOrgId, userId);
    const child = await this.db.organization.findFirst({
      where: { id: childOrgId, parentOrgId: agencyOrgId, deletedAt: null },
      include: {
        _count: {
          select: { memberships: true, agents: true, agentRuns: true, usageRecords: true },
        },
      },
    });
    if (!child) throw new NotFoundException('Child organization not found');

    // Usage this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const usageAgg = await this.db.usageRecord.aggregate({
      where: { orgId: childOrgId, createdAt: { gte: monthStart } },
      _sum: { totalCostUsd: true },
    });

    return {
      ...child,
      monthlySpendUsd: usageAgg._sum.totalCostUsd ?? 0,
    };
  }

  async provisionChildOrg(agencyOrgId: string, input: ProvisionOrgInput, userId: string) {
    const agency = await this.assertAgencyAdmin(agencyOrgId, userId);
    const parsed = provisionOrgSchema.parse(input);

    const existing = await this.db.organization.findFirst({
      where: { slug: parsed.slug, deletedAt: null },
    });
    if (existing) throw new BadRequestException(`Slug "${parsed.slug}" is already taken`);

    const child = await this.db.organization.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        industry: parsed.industry,
        ownerId: userId,
        parentOrgId: agencyOrgId,
        plan: parsed.plan,
        status: 'active',
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          requireApprovalForExternalEmail: true,
          requireApprovalForPayments: true,
          requireApprovalForRefunds: true,
          allowedAiProviders: ['anthropic', 'openai'],
          whitelabelEnabled: parsed.whitelabelEnabled,
          customDomain: parsed.customDomain ?? null,
          logoUrl: parsed.logoUrl ?? (agency.settings as Record<string, unknown>)?.logoUrl ?? null,
          primaryColor: parsed.primaryColor ?? null,
          monthlyAiBudgetUsd: null,
          managedByAgency: agencyOrgId,
        },
      },
    });

    // Auto-add agency admin as owner of child
    await this.db.membership.create({
      data: {
        userId,
        orgId: child.id,
        role: 'org_owner',
        acceptedAt: new Date(),
      },
    });

    return child;
  }

  async updateChildOrgSettings(
    agencyOrgId: string,
    childOrgId: string,
    settings: Record<string, unknown>,
    userId: string,
  ) {
    await this.assertAgencyAdmin(agencyOrgId, userId);
    const child = await this.db.organization.findFirst({
      where: { id: childOrgId, parentOrgId: agencyOrgId, deletedAt: null },
    });
    if (!child) throw new NotFoundException('Child organization not found');

    const allowedKeys = new Set([
      'whitelabelEnabled', 'customDomain', 'logoUrl', 'primaryColor',
      'monthlyAiBudgetUsd', 'requireApprovalForExternalEmail',
    ]);
    const safeSettings: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (allowedKeys.has(k)) safeSettings[k] = v;
    }

    return this.db.organization.update({
      where: { id: childOrgId },
      data: { settings: { ...(child.settings as object), ...safeSettings } },
    });
  }

  async suspendChildOrg(agencyOrgId: string, childOrgId: string, userId: string) {
    await this.assertAgencyAdmin(agencyOrgId, userId);
    const child = await this.db.organization.findFirst({
      where: { id: childOrgId, parentOrgId: agencyOrgId },
    });
    if (!child) throw new NotFoundException('Child organization not found');
    return this.db.organization.update({
      where: { id: childOrgId },
      data: { status: 'suspended' },
    });
  }

  async reactivateChildOrg(agencyOrgId: string, childOrgId: string, userId: string) {
    await this.assertAgencyAdmin(agencyOrgId, userId);
    const child = await this.db.organization.findFirst({
      where: { id: childOrgId, parentOrgId: agencyOrgId },
    });
    if (!child) throw new NotFoundException('Child organization not found');
    return this.db.organization.update({
      where: { id: childOrgId },
      data: { status: 'active' },
    });
  }

  // ─── Agency dashboard ─────────────────────────────────────────────────────

  async getDashboard(agencyOrgId: string, userId: string) {
    await this.assertAgencyAdmin(agencyOrgId, userId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [children, byStatus, monthlySpend] = await Promise.all([
      this.db.organization.count({ where: { parentOrgId: agencyOrgId, deletedAt: null } }),
      this.db.organization.groupBy({
        by: ['status'],
        where: { parentOrgId: agencyOrgId, deletedAt: null },
        _count: true,
      }),
      this.db.usageRecord.aggregate({
        where: {
          org: { parentOrgId: agencyOrgId },
          createdAt: { gte: monthStart },
        },
        _sum: { totalCostUsd: true },
      }),
    ]);

    // Top child orgs by agent run count this month
    const topOrgs = await this.db.agentRun.groupBy({
      by: ['orgId'],
      where: {
        org: { parentOrgId: agencyOrgId },
        createdAt: { gte: monthStart },
      },
      _count: true,
      orderBy: { _count: { orgId: 'desc' } },
      take: 5,
    });

    const topOrgIds = topOrgs.map((r) => r.orgId);
    const topOrgDetails = await this.db.organization.findMany({
      where: { id: { in: topOrgIds } },
      select: { id: true, name: true, slug: true },
    });
    const orgMap = Object.fromEntries(topOrgDetails.map((o) => [o.id, o]));

    return {
      totalChildren: children,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      monthlySpendUsd: monthlySpend._sum.totalCostUsd ?? 0,
      topActiveOrgs: topOrgs.map((r) => ({
        ...orgMap[r.orgId],
        agentRunCount: r._count,
      })),
    };
  }
}
