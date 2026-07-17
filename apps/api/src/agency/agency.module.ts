import { Module } from '@nestjs/common';
import { AgencyService } from './agency.service.js';
import { AgencyController } from './agency.controller.js';
import { DatabaseModule } from '../common/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AgencyController],
  providers: [AgencyService],
  exports: [AgencyService],
})
export class AgencyModule {}
