import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OrgsService } from './orgs.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an organization' })
  create(
    @Body() body: { name: string; slug: string; industry?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.orgs.create(body, req.user.sub);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.orgs.findById(orgId, req.user.sub);
  }

  @Put(':orgId')
  @ApiOperation({ summary: 'Update organization' })
  update(
    @Param('orgId') orgId: string,
    @Body() body: { name?: string; industry?: string; settings?: Record<string, unknown> },
    @Request() req: RequestWithUser,
  ) {
    return this.orgs.update(orgId, body, req.user.sub);
  }

  @Get(':orgId/members')
  @ApiOperation({ summary: 'List organization members' })
  listMembers(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.orgs.listMembers(orgId, req.user.sub);
  }

  @Delete(':orgId/members/:userId')
  @ApiOperation({ summary: 'Remove a member from the organization' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.orgs.removeMember(orgId, targetUserId, req.user.sub);
  }
}
