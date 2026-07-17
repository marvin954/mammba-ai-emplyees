import {
  Controller, Get, Post, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AgentRunsService } from './agent-runs.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { Throttle } from '../common/guards/throttle.guard.js';
import type { JwtPayload } from '../auth/auth.service.js';

interface RequestWithUser extends Request { user: JwtPayload }

@ApiTags('agent-runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orgs/:orgId/agent-runs')
export class AgentRunsController {
  constructor(private readonly runs: AgentRunsService) {}

  @Post()
  @Throttle({ limit: 30, ttl: 60 })
  @ApiOperation({ summary: 'Enqueue an agent run' })
  enqueue(
    @Param('orgId') orgId: string,
    @Body() body: { agentId: string; taskType: string; input: Record<string, unknown> },
    @Request() req: RequestWithUser,
  ) {
    return this.runs.enqueue(orgId, body, req.user.sub).then((id) => ({ runId: id }));
  }

  @Get()
  @ApiOperation({ summary: 'List recent agent runs' })
  list(
    @Param('orgId') orgId: string,
    @Query('agentId') agentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.runs.list(orgId, agentId, limit ? Number(limit) : undefined);
  }

  @Get(':runId')
  @ApiOperation({ summary: 'Get agent run status and output' })
  getStatus(@Param('orgId') orgId: string, @Param('runId') runId: string) {
    return this.runs.getStatus(orgId, runId);
  }

  @Delete(':runId')
  @ApiOperation({ summary: 'Cancel a queued or awaiting-approval run' })
  cancel(
    @Param('orgId') orgId: string,
    @Param('runId') runId: string,
    @Request() req: RequestWithUser,
  ) {
    return this.runs.cancel(orgId, runId, req.user.sub);
  }
}
