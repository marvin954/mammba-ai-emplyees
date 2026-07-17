# NexusOS — Phase 0: Discovery & Architecture

## 1. EvoNexus Repository Audit

**Status:** EvoNexus is accessed via the Claude Agent SDK as a runtime capability
(session model `claude-sonnet-4-6`). It is not a standalone open-source repository
that can be cloned and statically audited. EvoNexus is Anthropic's internal
multi-agent operating layer exposed through the Claude Code execution environment.

**What EvoNexus provides (observed capabilities):**
- Agent session lifecycle management
- Skill invocation system (`Skill` tool)
- Routine/trigger scheduling (`CronCreate`, `mcp__Claude_Code_Remote__create_trigger`)
- MCP server connectivity (Supabase, GitHub, Airtable, Notion, Vercel, Netlify, Canva, Higgs, etc.)
- Task tracking (`TaskCreate`, `TaskUpdate`, `TaskList`)
- Background agent spawning (`Agent` tool with subagent types)
- Web fetching & search
- File I/O within the session container

**Integration boundary decision:**
NexusOS will treat EvoNexus capabilities as a **privileged internal runtime**.
The `packages/evo-nexus-adapter` package wraps all EvoNexus interactions behind
typed contracts. No EvoNexus-specific API calls appear in business domain code.

**License & attribution:**
All EvoNexus capabilities are used under the terms of the Anthropic service agreement.
NexusOS will not claim affiliation with Anthropic, OpenAI, Google, RapidAPI, or n8n.

---

## 2. Current State vs Target State

| Dimension | Current State | Target State |
|-----------|--------------|-------------|
| Frontend | Static HTML files (3 AI employee pages) | Next.js 14 multi-tenant SaaS |
| Backend | None | NestJS API + BullMQ workers |
| Database | None | PostgreSQL + Prisma + Redis |
| Auth | None | NextAuth.js + RBAC |
| AI | None | Provider-neutral gateway (Claude/OpenAI/Gemini/Ollama) |
| Agents | None | EvoNexus adapter + 20 AI employees |
| Automation | None | n8n adapter + workflow templates |
| Integrations | None | RapidAPI gateway + MCP gateway |
| CRM | None | Full contact/company/deal/pipeline module |
| Billing | None | Stripe subscriptions + metered usage |
| Multi-tenancy | None | Organization-scoped row isolation + RLS |
| Observability | None | OpenTelemetry + structured logs |

---

## 3. System Context Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    EXTERNAL ACTORS                       │
│  Business Owner  │  Team Member  │  Client  │  Agency   │
└──────────┬────────────────────────────────────┬──────────┘
           │                                    │
           ▼                                    ▼
┌──────────────────────┐           ┌────────────────────────┐
│   NexusOS Web App    │           │  NexusOS Admin Portal  │
│   (Next.js SaaS)     │           │  (Platform Ops)        │
└──────────┬───────────┘           └───────────┬────────────┘
           │                                   │
           ▼                                   ▼
┌─────────────────────────────────────────────────────────┐
│              NexusOS API (NestJS BFF)                   │
│  Auth │ Orgs │ RBAC │ Business Domains │ AI Control     │
└───────────────────────────┬─────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  AI Control  │  │  Business    │  │  Execution       │
│  Plane       │  │  Services    │  │  Workers         │
│  (Gateway)   │  │  (CRM/Sales/ │  │  (BullMQ)        │
│              │  │   Marketing) │  │                  │
└──────┬───────┘  └──────────────┘  └──────────────────┘
       │
  ┌────┼────────────────────┐
  ▼    ▼                    ▼
Claude  OpenAI          Ollama
Gemini  OpenRouter
       │
  ┌────┼───────────────────────────────────┐
  ▼    ▼              ▼                    ▼
n8n  RapidAPI   MCP Servers          Internal
                (Gmail/GCal/         Business
                 GitHub/Notion)       Services
       │
       ▼
PostgreSQL │ Redis │ S3 │ pgvector
```

---

## 4. Container Diagram

```
apps/web           → Next.js 14 (Vercel / Node)
apps/api           → NestJS (containerized, horizontally scalable)
apps/worker        → BullMQ workers (containerized, horizontally scalable)
apps/admin         → Next.js admin portal (internal network only)

packages/database  → Prisma schema + migrations
packages/auth      → NextAuth config + RBAC helpers
packages/ai-core   → Provider-neutral LLM gateway
packages/agent-runtime → Agent lifecycle manager
packages/evo-nexus-adapter → EvoNexus bridge
packages/n8n-adapter       → n8n workflow engine bridge
packages/rapidapi-gateway  → RapidAPI proxy
packages/mcp-gateway       → MCP tool registry
packages/crm               → Contact/Company/Deal/Pipeline domain
packages/billing           → Stripe platform + tenant billing
packages/knowledge         → RAG ingestion + retrieval
packages/audit             → Immutable audit event system
packages/observability     → OpenTelemetry setup

infra/docker       → Docker Compose (local dev)
infra/migrations   → Database migration scripts
```

---

## 5. MVP Vertical Slice Sequence

```
User                 NexusOS API         AI Control Plane     External
────                 ───────────         ────────────────     ────────
 │ POST /auth/register    │                    │                  │
 │─────────────────────> │                    │                  │
 │ <── 201 + session ─── │                    │                  │
 │                       │                    │                  │
 │ POST /orgs            │                    │                  │
 │─────────────────────> │                    │                  │
 │ <── 201 org ────────  │                    │                  │
 │                       │                    │                  │
 │ POST /agents/install  │                    │                  │
 │  {template: "sales"}  │                    │                  │
 │─────────────────────> │                    │                  │
 │ <── 201 agent ──────  │                    │                  │
 │                       │                    │                  │
 │ POST /crm/leads       │                    │                  │
 │─────────────────────> │                    │                  │
 │                       │── enqueue job ──> Worker             │
 │                       │                   │── RapidAPI ─────>│
 │                       │                   │ <── enriched ─── │
 │                       │                   │── AI qualify ──> │AI
 │                       │                   │ <── analysis ─── │
 │                       │                   │── create contact │
 │                       │                   │── draft email    │
 │                       │                   │── create approval│
 │ <── 201 lead ──────── │                    │                  │
 │                       │                    │                  │
 │ GET /approvals        │                    │                  │
 │─────────────────────> │                    │                  │
 │ <── [approval item] ─ │                    │                  │
 │                       │                    │                  │
 │ POST /approvals/:id/approve                │                  │
 │─────────────────────> │                    │                  │
 │                       │── trigger n8n ──> Worker             │
 │                       │                   │── send email ───>│SMTP
 │                       │                   │── record audit   │
 │                       │                   │── meter usage    │
 │ <── 200 ────────────  │                    │                  │
 │                       │                    │                  │
 │ GET /dashboard        │                    │                  │
 │─────────────────────> │                    │                  │
 │ <── metrics ────────  │                    │                  │
```

---

## 6. Threat Model

| Threat | Mitigation |
|--------|-----------|
| Cross-tenant data leak | org_id on every table; RLS; data-access layer filter |
| Prompt injection via uploaded docs | Treat retrieved chunks as untrusted data |
| Credential exposure | Encrypted vault; never in browser payload |
| Agent privilege escalation | Tool allowlist per agent; no shell access |
| Insecure direct object reference | Resource ownership check on every query |
| Webhook replay | Timestamp + signature validation; idempotency keys |
| Mass email without consent | Approval required; suppression list; send limits |
| LLM authorizing its own sensitive action | Human-in-the-loop for financial/legal/medical actions |
| SSRF via integration URLs | Allowlist + proxy; block private ranges |
| Secrets in logs | Structured logging with redaction middleware |
| Brute force auth | Rate limiting; lockout; CAPTCHA on registration |
| Supply chain attack | Dependency scanning (Snyk/Dependabot); lockfiles |

---

## 7. Multi-Tenant Data Model (Core Tables)

```sql
organizations (id, name, slug, plan, status, created_at)
users (id, email, password_hash, mfa_secret, created_at)
memberships (id, user_id, org_id, role_id, created_at)
roles (id, org_id, name, permissions[])
api_credentials (id, org_id, provider, encrypted_value, created_at)
agents (id, org_id, template_id, name, config jsonb, status)
agent_runs (id, org_id, agent_id, status, input, output, cost, created_at)
contacts (id, org_id, email, name, company_id, created_at)
companies (id, org_id, name, domain, created_at)
deals (id, org_id, contact_id, stage_id, value, created_at)
approvals (id, org_id, run_id, action, status, reviewer_id, created_at)
audit_events (id, org_id, actor_id, action, resource_type, resource_id, payload jsonb, created_at)
usage_records (id, org_id, agent_id, model, tokens_in, tokens_out, cost_usd, created_at)
```

Every table includes `org_id` enforced at the query layer.
Row-level security enabled as secondary defense.

---

## 8. Agent Execution Contract

```typescript
interface AgentRunRequest {
  orgId: string;
  agentId: string;
  taskType: string;
  input: Record<string, unknown>;
  allowedTools: string[];
  modelConfig: ModelConfig;
  approvalPolicy: ApprovalPolicy;
  budgetUsd?: number;
  timeoutMs?: number;
}

interface AgentRunResult {
  runId: string;
  status: AgentRunStatus;
  output?: Record<string, unknown>;
  toolCalls: ToolCallRecord[];
  usage: UsageSummary;
  costUsd: number;
  durationMs: number;
  approvalRequired?: ApprovalRequest;
  auditEventIds: string[];
}

type AgentRunStatus =
  | 'queued' | 'planning' | 'awaiting_approval'
  | 'executing' | 'retrying' | 'completed'
  | 'partially_completed' | 'blocked' | 'failed' | 'cancelled';
```

---

## 9. Tool Permission Contract

```typescript
interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  requiredPermission: string;       // e.g. "tool.email.send"
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approvalPolicy: 'never' | 'optional' | 'always';
  costPolicy: CostPolicy;
  timeoutMs: number;
  idempotent: boolean;
  dataSensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  auditRequired: boolean;
}
```

---

## 10. n8n Integration Contract

```typescript
interface N8nWorkflowDefinition {
  id: string;
  orgId: string;
  templateId: string;
  name: string;
  n8nWorkflowId: string;
  credentialMappings: Record<string, string>;  // nexusCredId → n8nCredId
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  version: string;
}

interface N8nExecutionRequest {
  workflowId: string;
  orgId: string;
  agentRunId?: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
}
```

---

## 11. RapidAPI Integration Contract

```typescript
interface IntegrationManifest {
  id: string;
  name: string;
  category: string;
  version: string;
  provider: string;
  authenticationType: 'api_key' | 'oauth2' | 'basic';
  capabilities: string[];
  inputSchemas: Record<string, JSONSchema>;
  outputSchemas: Record<string, JSONSchema>;
  requiredPlan: 'starter' | 'professional' | 'business' | 'agency' | 'enterprise';
  estimatedCostPerCall?: number;
  rateLimit?: { requests: number; period: string };
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  regions?: string[];
  enabled: boolean;
}
```

---

## 12. Environment Variable Plan

```
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nexusos
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=<generated>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<your-google-oauth-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-secret>

# AI Providers
ANTHROPIC_API_KEY=<your-anthropic-key>
OPENAI_API_KEY=<your-openai-key>
GOOGLE_AI_API_KEY=<your-gemini-key>
OPENROUTER_API_KEY=<your-openrouter-key>
OLLAMA_BASE_URL=http://localhost:11434

# Stripe (Platform Billing)
STRIPE_SECRET_KEY=<your-stripe-secret>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable>

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=<your-smtp-user>
SMTP_PASS=<your-smtp-pass>
EMAIL_FROM=noreply@nexusos.io

# Object Storage
S3_BUCKET=nexusos-uploads
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=<your-s3-key>
S3_SECRET_KEY=<your-s3-secret>

# n8n
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=<your-n8n-key>
N8N_WEBHOOK_SECRET=<generated>

# RapidAPI
RAPIDAPI_KEY=<your-rapidapi-key>

# App
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
WORKER_CONCURRENCY=4
ENCRYPTION_KEY=<32-byte-hex>
```

---

## 13. 12-Week Phased Implementation Roadmap

| Week | Phase | Milestone |
|------|-------|-----------|
| 1 | Foundation | Monorepo, toolchain, Docker Compose, DB schema, migrations |
| 2 | Foundation | Auth (email+OAuth), organizations, memberships, RBAC |
| 3 | Foundation | Core API structure, audit system, dashboard shell |
| 4 | AI Plane | Provider gateway (Claude+OpenAI), model registry, streaming |
| 5 | AI Plane | Agent schema, run lifecycle, EvoNexus adapter, usage tracking |
| 6 | CRM + Agent | Contact/Company/Deal/Pipeline, Sales AI employee, approval inbox |
| 7 | Automation | n8n adapter, lead-to-appointment workflow, RapidAPI gateway |
| 8 | Automation | Enrichment integration, email delivery, follow-up sequences |
| 9 | Billing | Stripe subscriptions, metered usage, tenant payment links |
| 10 | Knowledge | Document ingestion, chunking, embeddings, RAG retrieval |
| 11 | Polish | Dashboard analytics, notifications, mobile layout, onboarding |
| 12 | Hardening | Tests, security review, CI/CD, deployment docs, load test |

---

## 14. First Sprint Backlog (Week 1)

1. Initialize pnpm monorepo with Turborepo
2. Configure strict TypeScript, ESLint, Prettier
3. Set up Vitest test runner
4. Create `packages/database` with Prisma schema (core tables)
5. Create `packages/types` with shared type definitions
6. Write and validate initial database migration
7. Create Docker Compose (PostgreSQL, Redis, pgvector)
8. Create `apps/api` skeleton (NestJS with health endpoint)
9. Create `apps/web` skeleton (Next.js 14 with App Router)
10. Create `packages/config` (env validation with Zod)
11. Set up CI pipeline (lint, typecheck, test, build)
12. Write README with local setup instructions

---

## 15. MVP Acceptance Criteria

- [ ] User can register with email + password
- [ ] User can create an organization
- [ ] User can install the Sales AI employee
- [ ] User can submit a lead via the CRM
- [ ] Lead is enriched via RapidAPI integration
- [ ] AI employee qualifies the lead and drafts an outreach email
- [ ] User receives an approval notification
- [ ] User can approve or reject the action
- [ ] On approval, n8n workflow sends the email and schedules follow-up
- [ ] CRM contact and activity are created with AI attribution
- [ ] Usage (tokens, cost) is recorded
- [ ] Audit log shows every action
- [ ] Dashboard metrics update
- [ ] Another organization cannot see this organization's data
- [ ] User can upgrade subscription
- [ ] User can invite a team member

---

## 16. Decisions Requiring Confirmation

1. **n8n deployment model**: Shared n8n instance with per-org projects vs. isolated n8n per enterprise customer?
2. **Email provider**: Resend vs. Postmark vs. SendGrid for transactional email?
3. **Vector DB**: pgvector (co-located) vs. separate Qdrant/Pinecone instance?
4. **Initial RapidAPI providers**: Which 5–10 enrichment/validation providers to integrate first?
5. **Stripe Connect**: Standard Connect (platform collects fees) vs. Express Connect vs. no platform fee on tenant payments?
6. **White-label domain**: Custom domain support from day 1 or post-MVP?
7. **Ollama**: Include local model support in MVP or defer to Phase 8?
8. **Admin portal**: Separate Next.js app or protected route group in the main app?
