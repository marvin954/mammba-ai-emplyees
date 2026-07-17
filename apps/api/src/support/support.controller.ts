import {
  Controller, Get, Post, Patch,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { SupportService, CreateTicketInput, UpdateTicketInput, AddMessageInput } from './support.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('orgs/:orgId/support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('summary')
  getSummary(@Param('orgId') orgId: string) {
    return this.support.getSummary(orgId);
  }

  @Get('tickets')
  listTickets(
    @Param('orgId') orgId: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.support.listTickets(orgId, {
      status,
      priority,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('tickets/:ticketId')
  getTicket(@Param('orgId') orgId: string, @Param('ticketId') ticketId: string) {
    return this.support.getTicket(orgId, ticketId);
  }

  @Post('tickets')
  createTicket(
    @Param('orgId') orgId: string,
    @Body() dto: CreateTicketInput,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.support.createTicket(orgId, dto, req.user?.sub ?? '');
  }

  @Patch('tickets/:ticketId')
  updateTicket(
    @Param('orgId') orgId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketInput,
  ) {
    return this.support.updateTicket(orgId, ticketId, dto);
  }

  @Post('tickets/:ticketId/messages')
  addMessage(
    @Param('orgId') orgId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: AddMessageInput,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.support.addMessage(orgId, ticketId, {
      ...dto,
      senderId: dto.senderId ?? req.user?.sub,
    });
  }

  @Post('tickets/:ticketId/assign/:agentId')
  assignToAgent(
    @Param('orgId') orgId: string,
    @Param('ticketId') ticketId: string,
    @Param('agentId') agentId: string,
  ) {
    return this.support.assignToAgent(orgId, ticketId, agentId);
  }
}
