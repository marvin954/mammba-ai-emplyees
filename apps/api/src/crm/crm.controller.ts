import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CrmService } from './crm.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  // Contacts
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

  // Deals
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
}
