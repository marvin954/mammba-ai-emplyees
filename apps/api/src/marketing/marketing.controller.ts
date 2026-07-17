import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { MarketingService, CreateCampaignInput, UpdateCampaignInput, CreateAssetInput } from './marketing.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('orgs/:orgId/marketing')
@UseGuards(JwtAuthGuard)
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('summary')
  getSummary(@Param('orgId') orgId: string) {
    return this.marketing.getSummary(orgId);
  }

  @Get('campaigns')
  listCampaigns(
    @Param('orgId') orgId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketing.listCampaigns(orgId, {
      status,
      type,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('campaigns/:campaignId')
  getCampaign(@Param('orgId') orgId: string, @Param('campaignId') campaignId: string) {
    return this.marketing.getCampaign(orgId, campaignId);
  }

  @Post('campaigns')
  createCampaign(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCampaignInput,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.marketing.createCampaign(orgId, dto, req.user?.sub ?? '');
  }

  @Patch('campaigns/:campaignId')
  updateCampaign(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpdateCampaignInput,
  ) {
    return this.marketing.updateCampaign(orgId, campaignId, dto);
  }

  @Delete('campaigns/:campaignId')
  deleteCampaign(@Param('orgId') orgId: string, @Param('campaignId') campaignId: string) {
    return this.marketing.deleteCampaign(orgId, campaignId);
  }

  // ─── Assets ─────────────────────────────────────────────────────────────

  @Post('campaigns/:campaignId/assets')
  createAsset(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateAssetInput,
  ) {
    return this.marketing.createAsset(orgId, campaignId, dto);
  }

  @Post('campaigns/:campaignId/assets/:assetId/approve')
  approveAsset(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.marketing.approveAsset(orgId, campaignId, assetId);
  }

  @Delete('campaigns/:campaignId/assets/:assetId')
  deleteAsset(
    @Param('orgId') orgId: string,
    @Param('campaignId') campaignId: string,
    @Param('assetId') assetId: string,
  ) {
    return this.marketing.deleteAsset(orgId, campaignId, assetId);
  }
}
