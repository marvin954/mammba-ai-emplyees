import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @ApiOperation({ summary: 'List approvals' })
  list(
    @Param('orgId') orgId: string,
    @Query('status') status?: string,
  ) {
    return this.approvals.list(orgId, { status });
  }

  @Get(':approvalId')
  @ApiOperation({ summary: 'Get approval details' })
  getOne(@Param('orgId') orgId: string, @Param('approvalId') approvalId: string) {
    return this.approvals.getById(orgId, approvalId);
  }

  @Post(':approvalId/approve')
  @ApiOperation({ summary: 'Approve a pending action' })
  approve(
    @Param('orgId') orgId: string,
    @Param('approvalId') approvalId: string,
    @Body() body: { note?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.approvals.approve(orgId, approvalId, req.user.sub, body.note);
  }

  @Post(':approvalId/reject')
  @ApiOperation({ summary: 'Reject a pending action' })
  reject(
    @Param('orgId') orgId: string,
    @Param('approvalId') approvalId: string,
    @Body() body: { note?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.approvals.reject(orgId, approvalId, req.user.sub, body.note);
  }
}
