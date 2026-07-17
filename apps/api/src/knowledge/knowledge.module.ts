import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeController } from './knowledge.controller.js';
import { DatabaseModule } from '../common/database.module.js';

@Module({
  imports: [
    DatabaseModule,
    MulterModule.register({ dest: '/tmp/uploads' }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
