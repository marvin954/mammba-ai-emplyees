import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgentsService } from './agents.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List available AI employee templates' })
  listTemplates() {
    return this.agents.listTemplates();
  }

  @Post('install')
  @ApiOperation({ summary: 'Install an AI employee from a template' })
  install(
    @Param('orgId') orgId: string,
    @Body() body: { templateId: string; name?: string; modelProvider?: string; modelName?: string },
    @Request() req: RequestWithUser,
  ) {
    return this.agents.installAgent(orgId, body.templateId, body, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List installed AI employees' })
  list(@Param('orgId') orgId: string) {
    return this.agents.listAgents(orgId);
  }

  @Get(':agentId')
  @ApiOperation({ summary: 'Get AI employee details' })
  getOne(@Param('orgId') orgId: string, @Param('agentId') agentId: string) {
    return this.agents.getAgent(orgId, agentId);
  }

  @Get(':agentId/runs')
  @ApiOperation({ summary: 'Get recent runs for an AI employee' })
  getRuns(@Param('orgId') orgId: string, @Param('agentId') agentId: string) {
    return this.agents.getRuns(orgId, agentId);
  }
}
