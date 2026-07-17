import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service.js';
import { MarketingController } from './marketing.controller.js';
import { DatabaseModule } from '../common/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [MarketingController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
