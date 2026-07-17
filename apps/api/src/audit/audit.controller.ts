import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { AuditService } from '@nexusos/audit';
import { PrismaClient } from '@nexusos/database';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/audit')
export class AuditController {
  private readonly auditService: AuditService;

  constructor(private readonly db: PrismaClient) {
    this.auditService = new AuditService(db);
  }

  @Get()
  @ApiOperation({ summary: 'List audit events for an org' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'cursor', required: false, description: 'ISO timestamp for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Param('orgId') orgId: string,
    @Request() req: RequestWithUser,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    await this.assertMember(orgId, req.user.sub);
    const safeLimit = Math.min(limit, 200);
    return this.auditService.list(orgId, {
      action,
      actorId,
      resourceType,
      cursor,
      limit: safeLimit,
    });
  }

  private async assertMember(orgId: string, userId: string): Promise<void> {
    const membership = await this.db.membership.findFirst({
      where: { orgId, userId },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('Not a member of this organization');
    // Audit logs require at least admin role
    if (!['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenException('Audit log access requires admin role');
    }
  }
}
