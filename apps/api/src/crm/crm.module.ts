import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller.js';
import { CrmService } from './crm.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
