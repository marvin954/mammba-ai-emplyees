import { Module } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { BillingController, WebhookController } from './billing.controller.js';
import { DatabaseModule } from '../common/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController, WebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
