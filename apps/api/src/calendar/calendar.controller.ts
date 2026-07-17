import {
  Controller, Get, Post, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CalendarService } from './calendar.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
import type { CalendarProvider } from './calendar.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('integrations')
  @ApiOperation({ summary: 'List connected calendar integrations' })
  listIntegrations(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.calendar.listIntegrations(orgId, req.user.sub);
  }

  @Delete('integrations/:provider')
  @ApiOperation({ summary: 'Disconnect a calendar integration' })
  disconnect(
    @Param('orgId') orgId: string,
    @Param('provider') provider: CalendarProvider,
    @Request() req: RequestWithUser,
  ) {
    return this.calendar.disconnectIntegration(orgId, req.user.sub, provider);
  }

  @Get('events')
  @ApiOperation({ summary: 'List upcoming calendar events' })
  listEvents(
    @Param('orgId') orgId: string,
    @Query('provider') provider?: CalendarProvider,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Request() req: RequestWithUser = {} as RequestWithUser,
  ) {
    return this.calendar.listEvents(orgId, req.user.sub, { provider, start, end });
  }

  @Get('slots')
  @ApiOperation({ summary: 'Find available appointment slots' })
  findSlots(
    @Param('orgId') orgId: string,
    @Query('provider') provider: CalendarProvider,
    @Query('date') date: string,
    @Query('durationMinutes') durationMinutes: string,
    @Request() req: RequestWithUser,
  ) {
    return this.calendar.findAvailableSlots(orgId, req.user.sub, {
      provider,
      date,
      durationMinutes: Number(durationMinutes ?? 30),
    });
  }

  @Post('events')
  @ApiOperation({ summary: 'Create a calendar event (stub until Phase 6 OAuth)' })
  createEvent(
    @Param('orgId') orgId: string,
    @Body() body: { provider: CalendarProvider } & Parameters<CalendarService['createEvent']>[3],
    @Request() req: RequestWithUser,
  ) {
    const { provider, ...input } = body;
    return this.calendar.createEvent(orgId, req.user.sub, provider, input);
  }
}
