import {
  Controller, Get, Put, Post, Delete, Patch,
  Body, Param, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { SettingsService } from './settings.service.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // ── Org ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Get organization settings' })
  getOrg(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.settings.getOrg(orgId, req.user.sub);
  }

  @Put()
  @ApiOperation({ summary: 'Update organization profile' })
  updateOrg(
    @Param('orgId') orgId: string,
    @Request() req: RequestWithUser,
    @Body() body: { name?: string; industry?: string; logoUrl?: string; domain?: string; settings?: Record<string, unknown> },
  ) {
    return this.settings.updateOrg(orgId, req.user.sub, body);
  }

  // ── Members ────────────────────────────────────────────────────────────────

  @Get('members')
  @ApiOperation({ summary: 'List members' })
  listMembers(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.settings.listMembers(orgId, req.user.sub);
  }

  @Patch('members/:targetUserId/role')
  @ApiOperation({ summary: 'Change a member role' })
  updateRole(
    @Param('orgId') orgId: string,
    @Param('targetUserId') targetUserId: string,
    @Request() req: RequestWithUser,
    @Body() body: { role: string },
  ) {
    return this.settings.updateMemberRole(orgId, req.user.sub, targetUserId, body.role);
  }

  @Delete('members/:targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member' })
  removeMember(
    @Param('orgId') orgId: string,
    @Param('targetUserId') targetUserId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.settings.removeMember(orgId, req.user.sub, targetUserId);
  }

  // ── Credentials ────────────────────────────────────────────────────────────

  @Get('credentials')
  @ApiOperation({ summary: 'List API credentials (names only, no values)' })
  listCredentials(@Param('orgId') orgId: string, @Request() req: RequestWithUser) {
    return this.settings.listCredentials(orgId, req.user.sub);
  }

  @Post('credentials')
  @ApiOperation({ summary: 'Store a new API credential (encrypted at rest)' })
  createCredential(
    @Param('orgId') orgId: string,
    @Request() req: RequestWithUser,
    @Body() body: { name: string; provider: string; value: string; metadata?: Record<string, unknown> },
  ) {
    return this.settings.createCredential(orgId, req.user.sub, body);
  }

  @Patch('credentials/:credentialId/rotate')
  @ApiOperation({ summary: 'Rotate (replace) a credential value' })
  rotateCredential(
    @Param('orgId') orgId: string,
    @Param('credentialId') credentialId: string,
    @Request() req: RequestWithUser,
    @Body() body: { value: string },
  ) {
    return this.settings.rotateCredential(orgId, req.user.sub, credentialId, body.value);
  }

  @Delete('credentials/:credentialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a credential' })
  deleteCredential(
    @Param('orgId') orgId: string,
    @Param('credentialId') credentialId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.settings.deleteCredential(orgId, req.user.sub, credentialId);
  }
}
