import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { DatabaseModule } from '../common/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
})
export class AuditModule {}
