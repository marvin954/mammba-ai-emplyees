import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';
import { z } from 'zod';

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  industry: z.string().default('other'),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  industry: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

@Injectable()
export class OrgsService {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateOrgInput, ownerId: string) {
    const parsed = createOrgSchema.parse(input);

    const org = await this.db.organization.create({
      data: {
        name: parsed.name,
        slug: parsed.slug,
        industry: parsed.industry,
        ownerId,
        status: 'trial',
        plan: 'starter',
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          requireApprovalForExternalEmail: true,
          requireApprovalForPayments: true,
          requireApprovalForRefunds: true,
          allowedAiProviders: ['anthropic', 'openai'],
          whitelabelEnabled: false,
          monthlyAiBudgetUsd: null,
        },
      },
    });

    // Create owner membership
    await this.db.membership.create({
      data: {
        userId: ownerId,
        orgId: org.id,
        role: 'org_owner',
        acceptedAt: new Date(),
      },
    });

    return org;
  }

  async findById(orgId: string, requestingUserId: string) {
    await this.assertMember(orgId, requestingUserId);
    const org = await this.db.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, input: UpdateOrgInput, requestingUserId: string) {
    await this.assertAdmin(orgId, requestingUserId);
    const parsed = updateOrgSchema.parse(input);

    return this.db.organization.update({
      where: { id: orgId },
      data: {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.industry ? { industry: parsed.industry } : {}),
        ...(parsed.settings ? { settings: parsed.settings as never } : {}),
      },
    });
  }

  async listMembers(orgId: string, requestingUserId: string) {
    await this.assertMember(orgId, requestingUserId);
    return this.db.membership.findMany({
      where: { orgId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
  }

  async removeMember(orgId: string, targetUserId: string, requestingUserId: string) {
    const membership = await this.db.membership.findUnique({
      where: { userId_orgId: { userId: requestingUserId, orgId } },
    });

    if (membership?.role !== 'org_owner' && membership?.role !== 'org_admin') {
      throw new ForbiddenException('Insufficient permissions');
    }

    const targetMembership = await this.db.membership.findUnique({
      where: { userId_orgId: { userId: targetUserId, orgId } },
    });

    if (targetMembership?.role === 'org_owner') {
      throw new ForbiddenException('Cannot remove the organization owner');
    }

    await this.db.membership.delete({
      where: { userId_orgId: { userId: targetUserId, orgId } },
    });
  }

  private async assertMember(orgId: string, userId: string): Promise<void> {
    const membership = await this.db.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }
  }

  private async assertAdmin(orgId: string, userId: string): Promise<void> {
    const membership = await this.db.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!membership || !['org_owner', 'org_admin'].includes(membership.role)) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
