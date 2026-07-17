import {
  Controller, Get, Param, Query, UseGuards, Request,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { AnalyticsService } from './analytics.service.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Aggregated analytics summary' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Look-back window in days (default 30)' })
  async summary(
    @Param('orgId') orgId: string,
    @Request() req: RequestWithUser,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    await this.analytics.assertMember(orgId, req.user.sub);
    return this.analytics.getSummary(orgId, Math.min(days, 365));
  }

  @Get('runs')
  @ApiOperation({ summary: 'Recent agent run timeline' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async runs(
    @Param('orgId') orgId: string,
    @Request() req: RequestWithUser,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    await this.analytics.assertMember(orgId, req.user.sub);
    return this.analytics.getRunTimeline(orgId, Math.min(days, 90));
  }
}
