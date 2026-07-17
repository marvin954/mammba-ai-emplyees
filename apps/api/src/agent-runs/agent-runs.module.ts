import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '@nexusos/events';
import { AgentRunsController } from './agent-runs.controller.js';
import { AgentRunsService } from './agent-runs.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.AGENT_RUNS }),
  ],
  controllers: [AgentRunsController],
  providers: [AgentRunsService],
  exports: [AgentRunsService],
})
export class AgentRunsModule {}
