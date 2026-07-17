import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CrmController } from './crm.controller.js';
import { CrmService } from './crm.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AgentRunsModule } from '../agent-runs/agent-runs.module.js';
import { QUEUE_NAMES } from '@nexusos/events';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => AgentRunsModule),
    BullModule.registerQueue({ name: QUEUE_NAMES.ENRICHMENT }),
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
