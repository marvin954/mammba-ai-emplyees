import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrgsModule } from './orgs/orgs.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { CrmModule } from './crm/crm.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { DatabaseModule } from './common/database.module.js';

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRoot({
      redis: {
        host: new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').hostname,
        port: Number(new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6379').port || 6379),
      },
    }),
    HealthModule,
    AuthModule,
    OrgsModule,
    AgentsModule,
    CrmModule,
    ApprovalsModule,
  ],
})
export class AppModule {}
