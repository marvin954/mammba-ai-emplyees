import { Module, forwardRef } from '@nestjs/common';
import { CrmController } from './crm.controller.js';
import { CrmService } from './crm.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { AgentRunsModule } from '../agent-runs/agent-runs.module.js';

@Module({
  imports: [AuthModule, forwardRef(() => AgentRunsModule)],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
