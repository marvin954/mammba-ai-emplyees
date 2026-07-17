import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EmailDraftsService } from './email-drafts.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('email-drafts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/email-drafts')
export class EmailDraftsController {
  constructor(private readonly drafts: EmailDraftsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an email draft' })
  create(
    @Param('orgId') orgId: string,
    @Body() body: Parameters<EmailDraftsService['create']>[1],
  ) {
    return this.drafts.create(orgId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List email drafts' })
  list(
    @Param('orgId') orgId: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.drafts.list(orgId, {
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':draftId')
  @ApiOperation({ summary: 'Get a single email draft' })
  getById(@Param('orgId') orgId: string, @Param('draftId') draftId: string) {
    return this.drafts.getById(orgId, draftId);
  }

  @Post(':draftId/submit')
  @ApiOperation({ summary: 'Submit draft for human approval' })
  submit(
    @Param('orgId') orgId: string,
    @Param('draftId') draftId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.drafts.submitForApproval(orgId, draftId, req.user.sub);
  }

  @Post(':draftId/approve')
  @ApiOperation({ summary: 'Approve and send draft (admin/owner or approval webhook)' })
  approve(
    @Param('orgId') orgId: string,
    @Param('draftId') draftId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.drafts.approveAndSend(orgId, draftId, req.user.sub);
  }

  @Post(':draftId/reject')
  @ApiOperation({ summary: 'Reject an email draft' })
  reject(
    @Param('orgId') orgId: string,
    @Param('draftId') draftId: string,
    @Body() body: { reason?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.drafts.reject(orgId, draftId, req.user.sub, body.reason);
  }
}
