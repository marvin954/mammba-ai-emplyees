import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { AutomationsService } from './automations.service.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/automations')
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  list(@Param('orgId') orgId: string) {
    return this.automations.list(orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a workflow' })
  create(
    @Param('orgId') orgId: string,
    @Request() req: RequestWithUser,
    @Body() body: { name: string; description?: string; config?: Record<string, unknown> },
  ) {
    return this.automations.create(orgId, req.user.sub, body);
  }

  @Get(':workflowId')
  @ApiOperation({ summary: 'Get workflow detail' })
  getOne(@Param('orgId') orgId: string, @Param('workflowId') workflowId: string) {
    return this.automations.getOne(orgId, workflowId);
  }

  @Put(':workflowId')
  @ApiOperation({ summary: 'Update workflow' })
  update(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @Request() req: RequestWithUser,
    @Body() body: { name?: string; description?: string; config?: Record<string, unknown> },
  ) {
    return this.automations.update(orgId, req.user.sub, workflowId, body);
  }

  @Patch(':workflowId/toggle')
  @ApiOperation({ summary: 'Toggle workflow active state' })
  toggle(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.automations.toggle(orgId, req.user.sub, workflowId);
  }

  @Post(':workflowId/trigger')
  @ApiOperation({ summary: 'Manually trigger a workflow run' })
  trigger(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @Request() req: RequestWithUser,
    @Body() body: Record<string, unknown>,
  ) {
    return this.automations.trigger(orgId, req.user.sub, workflowId, body);
  }

  @Get(':workflowId/executions')
  @ApiOperation({ summary: 'List recent workflow executions' })
  executions(@Param('orgId') orgId: string, @Param('workflowId') workflowId: string) {
    return this.automations.getExecutions(orgId, workflowId);
  }

  @Delete(':workflowId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workflow' })
  delete(
    @Param('orgId') orgId: string,
    @Param('workflowId') workflowId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.automations.delete(orgId, req.user.sub, workflowId);
  }
}
