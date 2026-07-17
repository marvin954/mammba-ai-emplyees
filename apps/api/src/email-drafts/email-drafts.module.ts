import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailDraftsController } from './email-drafts.controller.js';
import { EmailDraftsService } from './email-drafts.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { QUEUE_NAMES } from '@nexusos/events';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL }),
  ],
  controllers: [EmailDraftsController],
  providers: [EmailDraftsService],
  exports: [EmailDraftsService],
})
export class EmailDraftsModule {}
