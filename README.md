# NexusOS

**Multi-Tenant AI Business Operating System**

NexusOS gives companies AI employees, CRM, sales automation, marketing, workflow automation, payments, and analytics in one platform.

> NexusOS is not affiliated with Anthropic, OpenAI, Google, RapidAPI, or n8n.

---

## Architecture

```
apps/web          → Next.js 14 customer SaaS frontend (Vercel)
apps/api          → NestJS REST API + BFF
apps/worker       → BullMQ background workers (agent runs, n8n, email)
apps/admin        → Platform admin portal

packages/
  types           → Shared TypeScript types
  config          → Zod environment validation
  database        → Prisma schema + client
  ai-core         → Provider-neutral LLM gateway (Claude, OpenAI, Gemini, Ollama)
  agent-runtime   → Agent execution lifecycle
  evo-nexus-adapter → EvoNexus integration layer
  n8n-adapter     → n8n workflow engine bridge
  rapidapi-gateway  → RapidAPI integration proxy
  crm             → CRM domain logic
  audit           → Immutable audit events
  billing         → Stripe platform + tenant payments
  knowledge       → RAG ingestion + retrieval

infra/docker      → Docker Compose (local dev stack)
workflows/n8n     → n8n workflow JSON templates
agents/           → AI employee definitions
docs/architecture → ADRs, diagrams, threat model
```

---

## Local Development

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd nexusos
pnpm install

# 2. Copy environment file
cp .env.example .env
# Edit .env with your API keys

# 3. Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# 4. Run database migrations
pnpm db:migrate

# 5. Start all services in development mode
pnpm dev
```

Services will be available at:
- **Web App**: http://localhost:3000
- **API**: http://localhost:4000
- **API Docs**: http://localhost:4000/api/docs
- **n8n**: http://localhost:5678
- **Email (Mailpit)**: http://localhost:8025

---

## AI Providers

NexusOS uses a provider-neutral AI gateway. Configure any combination:

| Provider | Environment Variable |
|----------|---------------------|
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GOOGLE_AI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Ollama (local) | `OLLAMA_BASE_URL` |

Default model: `claude-sonnet-4-6` (configurable per organization and per agent).

---

## AI Employees

Platform AI employees available to all organizations:

| Employee | Department | Template ID |
|----------|-----------|-------------|
| Sales Development Representative | Sales | `tpl_sales_sdr` |
| Executive Assistant | Executive | `tpl_exec_assistant` |
| Customer Support Agent | Support | `tpl_customer_support` |

Additional employees (Marketing Manager, Operations Manager, etc.) are added in Phase 8.

---

## Security

- All tenant data is scoped by `org_id` at the query layer
- PostgreSQL Row Level Security enabled as secondary defense
- Agent tool access is restricted by explicit allowlists per agent
- All AI-triggered external actions require human approval by default
- Credentials are encrypted at rest (AES-256)
- Audit events are immutable and cannot be deleted
- No shell access is exposed to AI agents or customers
- Webhook signatures are validated before processing

---

## Implementation Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0 — Discovery | ✅ Complete | Architecture, threat model, data model, contracts |
| 1 — Foundation | 🔄 In Progress | Monorepo, auth, orgs, RBAC, DB, dashboard shell |
| 2 — AI Plane | Planned | Provider gateway, agent lifecycle, EvoNexus adapter |
| 3 — CRM + Agent | Planned | Contacts, deals, Sales AI employee, approvals |
| 4 — n8n + RapidAPI | Planned | Workflow templates, enrichment integration |
| 5 — Communication | Planned | Email, notifications, calendar |
| 6 — Billing | Planned | Stripe subscriptions, metered usage |
| 7 — Knowledge | Planned | RAG ingestion, retrieval, citations |
| 8 — Departments | Planned | Marketing, support, operations, analytics |
| 9 — Marketplace | Planned | Marketplace, agency mode, white-label |
| 10 — Hardening | Planned | Security audit, load test, DR, runbooks |

---

## Attribution

- Agent runtime capabilities powered by the Claude Agent SDK (Anthropic)
- Workflow automation by n8n (fair-code license)
- All third-party trademarks belong to their respective owners

---

## License

Proprietary — NexusOS platform code. See LICENSE for details.
