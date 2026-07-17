import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CrmService } from './crm.service.js';
import { AgentRunsService } from '../agent-runs/agent-runs.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/crm')
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly agentRuns: AgentRunsService,
  ) {}

  // ─── Companies ─────────────────────────────────────────────────────────────

  @Post('companies')
  @ApiOperation({ summary: 'Create a company' })
  createCompany(
    @Param('orgId') orgId: string,
    @Body() body: Parameters<CrmService['createCompany']>[1],
    @Request() req: RequestWithUser,
  ) {
    return this.crm.createCompany(orgId, body, req.user.sub);
  }

  @Get('companies')
  @ApiOperation({ summary: 'List companies' })
  listCompanies(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.crm.listCompanies(orgId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('companies/:companyId')
  @ApiOperation({ summary: 'Get company details' })
  getCompany(@Param('orgId') orgId: string, @Param('companyId') companyId: string) {
    return this.crm.getCompany(orgId, companyId);
  }

  @Put('companies/:companyId')
  @ApiOperation({ summary: 'Update a company' })
  updateCompany(
    @Param('orgId') orgId: string,
    @Param('companyId') companyId: string,
    @Body() body: Parameters<CrmService['updateCompany']>[2],
  ) {
    return this.crm.updateCompany(orgId, companyId, body);
  }

  @Delete('companies/:companyId')
  @ApiOperation({ summary: 'Delete a company' })
  deleteCompany(@Param('orgId') orgId: string, @Param('companyId') companyId: string) {
    return this.crm.deleteCompany(orgId, companyId);
  }

  // ─── Contacts ─────────────────────────────────────────────────────────────

  @Post('contacts')
  @ApiOperation({ summary: 'Create a contact' })
  createContact(
    @Param('orgId') orgId: string,
    @Body() body: Parameters<CrmService['createContact']>[1],
    @Request() req: RequestWithUser,
  ) {
    return this.crm.createContact(orgId, body, req.user.sub);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'List contacts' })
  listContacts(
    @Param('orgId') orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.crm.listContacts(orgId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
    });
  }

  @Get('contacts/:contactId')
  @ApiOperation({ summary: 'Get contact details' })
  getContact(@Param('orgId') orgId: string, @Param('contactId') contactId: string) {
    return this.crm.getContact(orgId, contactId);
  }

  @Put('contacts/:contactId')
  @ApiOperation({ summary: 'Update a contact' })
  updateContact(
    @Param('orgId') orgId: string,
    @Param('contactId') contactId: string,
    @Body() body: Parameters<CrmService['updateContact']>[2],
  ) {
    return this.crm.updateContact(orgId, contactId, body);
  }

  @Delete('contacts/:contactId')
  @ApiOperation({ summary: 'Delete a contact' })
  deleteContact(@Param('orgId') orgId: string, @Param('contactId') contactId: string) {
    return this.crm.deleteContact(orgId, contactId);
  }

  @Post('contacts/:contactId/score')
  @ApiOperation({ summary: 'Refresh lead score for a contact' })
  refreshLeadScore(@Param('orgId') orgId: string, @Param('contactId') contactId: string) {
    return this.crm.refreshLeadScore(orgId, contactId);
  }

  // ─── Deals ────────────────────────────────────────────────────────────────

  @Post('deals')
  @ApiOperation({ summary: 'Create a deal' })
  createDeal(
    @Param('orgId') orgId: string,
    @Body() body: Parameters<CrmService['createDeal']>[1],
    @Request() req: RequestWithUser,
  ) {
    return this.crm.createDeal(orgId, body, req.user.sub);
  }

  @Get('deals')
  @ApiOperation({ summary: 'List deals' })
  listDeals(
    @Param('orgId') orgId: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('stageId') stageId?: string,
  ) {
    return this.crm.listDeals(orgId, { pipelineId, stageId });
  }

  @Patch('deals/:dealId/stage')
  @ApiOperation({ summary: 'Move a deal to a different pipeline stage' })
  moveDealToStage(
    @Param('orgId') orgId: string,
    @Param('dealId') dealId: string,
    @Body() body: { stageId: string },
    @Request() req: RequestWithUser,
  ) {
    return this.crm.moveDealToStage(orgId, dealId, body.stageId, req.user.sub);
  }

  // ─── Activity feed ────────────────────────────────────────────────────────

  @Get('activities')
  @ApiOperation({ summary: 'List activities (optionally filtered by contact or deal)' })
  listActivities(
    @Param('orgId') orgId: string,
    @Query('contactId') contactId?: string,
    @Query('dealId') dealId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.crm.listActivities(orgId, {
      contactId,
      dealId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ─── Lead submission ──────────────────────────────────────────────────────

  @Post('leads')
  @ApiOperation({ summary: 'Submit a new lead — optionally triggers AI qualification' })
  async submitLead(
    @Param('orgId') orgId: string,
    @Body() body: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      companyName?: string;
      source?: string;
      customFields?: Record<string, unknown>;
      agentId?: string;
    },
    @Request() req: RequestWithUser,
  ) {
    const { agentId, ...leadData } = body;
    const { contactId, dealId } = await this.crm.submitLead(orgId, leadData, req.user.sub);

    let agentRunId: string | null = null;
    if (agentId) {
      agentRunId = await this.agentRuns.enqueue(
        orgId,
        { agentId, taskType: 'qualify_lead', input: { contactId, dealId, ...leadData } },
        req.user.sub,
      );
    }

    return { contactId, dealId, agentRunId };
  }
}
