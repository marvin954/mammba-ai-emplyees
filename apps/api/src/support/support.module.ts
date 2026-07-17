import { Module } from '@nestjs/common';
import { SupportService } from './support.service.js';
import { SupportController } from './support.controller.js';
import { DatabaseModule } from '../common/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
