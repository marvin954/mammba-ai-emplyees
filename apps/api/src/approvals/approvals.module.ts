import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { QUEUE_NAMES } from '@nexusos/events';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.APPROVALS }),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
