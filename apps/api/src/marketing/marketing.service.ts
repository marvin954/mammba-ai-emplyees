import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

export interface CreateCampaignInput {
  name: string;
  type: 'email' | 'social' | 'content' | 'paid' | 'event';
  description?: string;
  goal?: string;
  targetAudience?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  description?: string;
  goal?: string;
  targetAudience?: string;
  budget?: number;
  spend?: number;
  startDate?: string;
  endDate?: string;
  metrics?: Record<string, unknown>;
}

export interface CreateAssetInput {
  type: 'email' | 'social_post' | 'ad_copy' | 'landing_page' | 'image';
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MarketingService {
  constructor(private readonly db: PrismaClient) {}

  // ─── Campaigns ────────────────────────────────────────────────────────────

  async listCampaigns(
    orgId: string,
    options: { status?: string; type?: string; page?: number; limit?: number } = {},
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.type ? { type: options.type } : {}),
    };

    const [data, total] = await Promise.all([
      this.db.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { assets: true } } },
      }),
      this.db.campaign.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getCampaign(orgId: string, campaignId: string) {
    const c = await this.db.campaign.findFirst({
      where: { id: campaignId, orgId },
      include: {
        assets: { orderBy: { createdAt: 'desc' } },
        _count: { select: { assets: true } },
      },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async createCampaign(orgId: string, input: CreateCampaignInput, createdById: string) {
    return this.db.campaign.create({
      data: {
        orgId,
        name: input.name,
        type: input.type,
        description: input.description ?? null,
        goal: input.goal ?? null,
        targetAudience: input.targetAudience ?? null,
        budget: input.budget ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        createdById,
      },
    });
  }

  async updateCampaign(orgId: string, campaignId: string, input: UpdateCampaignInput) {
    await this.assertCampaign(orgId, campaignId);
    return this.db.campaign.update({
      where: { id: campaignId },
      data: {
        ...input,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        metrics: input.metrics as never,
      },
    });
  }

  async deleteCampaign(orgId: string, campaignId: string) {
    await this.assertCampaign(orgId, campaignId);
    await this.db.campaign.delete({ where: { id: campaignId } });
  }

  // ─── Assets ───────────────────────────────────────────────────────────────

  async createAsset(orgId: string, campaignId: string, input: CreateAssetInput) {
    await this.assertCampaign(orgId, campaignId);
    return this.db.campaignAsset.create({
      data: {
        campaignId,
        orgId,
        type: input.type,
        name: input.name,
        content: input.content,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  }

  async approveAsset(orgId: string, campaignId: string, assetId: string) {
    await this.assertCampaign(orgId, campaignId);
    const asset = await this.db.campaignAsset.findFirst({ where: { id: assetId, campaignId } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status === 'published') throw new BadRequestException('Asset already published');
    return this.db.campaignAsset.update({ where: { id: assetId }, data: { status: 'approved' } });
  }

  async deleteAsset(orgId: string, campaignId: string, assetId: string) {
    await this.assertCampaign(orgId, campaignId);
    await this.db.campaignAsset.deleteMany({ where: { id: assetId, campaignId } });
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getSummary(orgId: string) {
    const [total, byStatus, byType] = await Promise.all([
      this.db.campaign.count({ where: { orgId } }),
      this.db.campaign.groupBy({ by: ['status'], where: { orgId }, _count: true }),
      this.db.campaign.groupBy({ by: ['type'], where: { orgId }, _count: true }),
    ]);

    const spendAgg = await this.db.campaign.aggregate({
      where: { orgId },
      _sum: { spend: true, budget: true },
    });

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      byType: Object.fromEntries(byType.map((r) => [r.type, r._count])),
      totalSpend: spendAgg._sum.spend ?? 0,
      totalBudget: spendAgg._sum.budget ?? 0,
    };
  }

  private async assertCampaign(orgId: string, campaignId: string) {
    const c = await this.db.campaign.findFirst({ where: { id: campaignId, orgId } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }
}
