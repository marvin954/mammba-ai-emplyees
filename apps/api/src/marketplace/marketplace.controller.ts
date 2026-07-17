import {
  Controller, Get, Post, Delete, Patch,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  // ─── Public marketplace listing (org-scoped to annotate installed status) ─

  @Get('marketplace/plugins')
  listPlugins(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: { user?: { orgId?: string } },
  ) {
    return this.marketplace.listPlugins({
      category,
      search,
      orgId: req?.user?.orgId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('marketplace/plugins/:slug')
  getPlugin(@Param('slug') slug: string, @Req() req?: { user?: { orgId?: string } }) {
    return this.marketplace.getPlugin(slug, req?.user?.orgId);
  }

  @Post('marketplace/plugins/validate')
  validateManifest(@Body() manifest: unknown) {
    return this.marketplace.validateManifest(manifest);
  }

  // ─── Org-scoped install / manage ─────────────────────────────────────────

  @Get('orgs/:orgId/plugins')
  listInstalled(@Param('orgId') orgId: string) {
    return this.marketplace.listInstalled(orgId);
  }

  @Post('orgs/:orgId/plugins/:slug')
  install(
    @Param('orgId') orgId: string,
    @Param('slug') slug: string,
    @Body() body?: { config?: Record<string, unknown> },
  ) {
    return this.marketplace.installPlugin(orgId, slug, body?.config);
  }

  @Delete('orgs/:orgId/plugins/:slug')
  uninstall(@Param('orgId') orgId: string, @Param('slug') slug: string) {
    return this.marketplace.uninstallPlugin(orgId, slug);
  }

  @Patch('orgs/:orgId/plugins/:slug/config')
  updateConfig(
    @Param('orgId') orgId: string,
    @Param('slug') slug: string,
    @Body() body: { config: Record<string, unknown> },
  ) {
    return this.marketplace.updatePluginConfig(orgId, slug, body.config);
  }

  // ─── Publish (third-party developers) ────────────────────────────────────

  @Post('orgs/:orgId/plugins/publish')
  publish(
    @Param('orgId') orgId: string,
    @Body() manifest: unknown,
  ) {
    return this.marketplace.publishPlugin(orgId, manifest);
  }
}
