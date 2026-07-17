import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service.js';
import { MarketplaceController } from './marketplace.controller.js';
import { DatabaseModule } from '../common/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
