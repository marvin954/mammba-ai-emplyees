import {
  Controller, Get, Patch, Param, Query,
  UseGuards, Request, Res, Sse,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';
import { Observable, interval, map, takeUntil, Subject } from 'rxjs';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  list(
    @Param('orgId') orgId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req: RequestWithUser = {} as RequestWithUser,
  ) {
    return this.notifications.list(orgId, req.user.sub, {
      unreadOnly: unreadOnly === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.notifications.getUnreadCount(orgId, req.user.sub).then((count) => ({ count }));
  }

  @Patch(':notificationId/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @Param('orgId') orgId: string,
    @Param('notificationId') notificationId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.notifications.markRead(orgId, req.user.sub, notificationId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.notifications.markAllRead(orgId, req.user.sub);
  }
}
