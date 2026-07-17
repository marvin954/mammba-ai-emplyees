import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrgsModule } from './orgs/orgs.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { CrmModule } from './crm/crm.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { AgentRunsModule } from './agent-runs/agent-runs.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { EmailDraftsModule } from './email-drafts/email-drafts.module.js';
import { CalendarModule } from './calendar/calendar.module.js';
import { BillingModule } from './billing/billing.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { MarketingModule } from './marketing/marketing.module.js';
import { SupportModule } from './support/support.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { AgencyModule } from './agency/agency.module.js';
import { AuditModule } from './audit/audit.module.js';
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
    AgentRunsModule,
    NotificationsModule,
    EmailDraftsModule,
    CalendarModule,
    BillingModule,
    KnowledgeModule,
    MarketingModule,
    SupportModule,
    FinanceModule,
    MarketplaceModule,
    AgencyModule,
    AuditModule,
  ],
})
export class AppModule {}
