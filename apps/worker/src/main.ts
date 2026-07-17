import { PrismaClient } from '@nexusos/database';
import { AiGateway } from '@nexusos/ai-core';
import { AgentRunner, ToolRegistry, registerBuiltinTools } from '@nexusos/agent-runtime';
import { AuditService } from '@nexusos/audit';
import { QUEUE_NAMES } from '@nexusos/events';
import { AgentRunProcessor } from './processors/agent-run.processor.js';
import { ApprovalProcessor } from './processors/approval.processor.js';
import { WorkflowProcessor } from './processors/workflow.processor.js';
import { EnrichmentProcessor } from './processors/enrichment.processor.js';
import { EmailProcessor } from './processors/email.processor.js';
import { createWorker } from './queues/worker-factory.js';

async function bootstrap(): Promise<void> {
  console.warn('[Worker] Starting NexusOS background worker...');

  const db = new PrismaClient({ log: ['warn', 'error'] });

  const gateway = new AiGateway(
    {
      anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
      openaiApiKey: process.env['OPENAI_API_KEY'],
      openrouterApiKey: process.env['OPENROUTER_API_KEY'],
      ollamaBaseUrl: process.env['OLLAMA_BASE_URL'],
    },
    db,
  );

  const registry = new ToolRegistry();
  registerBuiltinTools(registry, db);

  const audit = new AuditService(db);

  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redisConfig = {
    host: new URL(redisUrl).hostname,
    port: Number(new URL(redisUrl).port || 6379),
    maxRetriesPerRequest: null as null,
  };

  const concurrency = Number(process.env['WORKER_CONCURRENCY'] ?? 4);

  // ── Agent run worker ────────────────────────────────────────────────────────
  const runner = new AgentRunner(db, gateway, registry, audit);
  const agentRunProcessor = new AgentRunProcessor(runner);

  const agentRunWorker = createWorker(
    QUEUE_NAMES.AGENT_RUNS,
    (job) => agentRunProcessor.process(job),
    redisConfig,
    concurrency,
  );

  // ── Approval worker ─────────────────────────────────────────────────────────
  const approvalProcessor = new ApprovalProcessor(db, audit, redisConfig);

  const approvalWorker = createWorker(
    QUEUE_NAMES.APPROVALS,
    (job) => approvalProcessor.process(job),
    redisConfig,
    concurrency,
  );

  // ── Workflow worker ─────────────────────────────────────────────────────────
  const n8nBaseUrl = process.env['N8N_BASE_URL'] ?? 'http://localhost:5678';
  const n8nApiKey = process.env['N8N_API_KEY'] ?? '';
  const n8nWebhookSecret = process.env['N8N_WEBHOOK_SECRET'] ?? '';

  const workflowProcessor = new WorkflowProcessor(db, audit, n8nBaseUrl, n8nApiKey, n8nWebhookSecret);

  const workflowWorker = createWorker(
    QUEUE_NAMES.WORKFLOWS,
    (job) => workflowProcessor.process(job),
    redisConfig,
    Math.ceil(concurrency / 2), // workflow calls are slower; lower concurrency
  );

  // ── Enrichment worker ───────────────────────────────────────────────────────
  const rapidApiKey = process.env['RAPIDAPI_KEY'] ?? '';

  const enrichmentProcessor = new EnrichmentProcessor(db, audit, rapidApiKey);

  const enrichmentWorker = createWorker(
    QUEUE_NAMES.ENRICHMENT,
    (job) => enrichmentProcessor.process(job),
    redisConfig,
    Math.ceil(concurrency / 2), // RapidAPI rate-limited; lower concurrency
  );

  // ── Email worker ─────────────────────────────────────────────────────────────
  const emailProcessor = new EmailProcessor(db, audit);

  const emailWorker = createWorker(
    QUEUE_NAMES.EMAIL,
    (job) => emailProcessor.process(job),
    redisConfig,
    Math.ceil(concurrency / 2),
  );

  // ── Event logging ────────────────────────────────────────────────────────────
  const allWorkers = [
    { name: QUEUE_NAMES.AGENT_RUNS, worker: agentRunWorker },
    { name: QUEUE_NAMES.APPROVALS, worker: approvalWorker },
    { name: QUEUE_NAMES.WORKFLOWS, worker: workflowWorker },
    { name: QUEUE_NAMES.ENRICHMENT, worker: enrichmentWorker },
    { name: QUEUE_NAMES.EMAIL, worker: emailWorker },
  ];

  for (const { name, worker } of allWorkers) {
    worker.on('completed', (job) => console.warn(`[${name}] Job ${job.id} completed`));
    worker.on('failed', (job, err) => console.error(`[${name}] Job ${job?.id} failed:`, err.message));
  }

  console.warn(`[Worker] Listening on queues: ${Object.values(QUEUE_NAMES).join(', ')}`);

  // ── Graceful shutdown ────────────────────────────────────────────────────────
  process.on('SIGTERM', async () => {
    console.warn('[Worker] SIGTERM received — closing gracefully');
    await Promise.all(allWorkers.map(({ worker }) => worker.close()));
    await approvalProcessor.close();
    await db.$disconnect();
    process.exit(0);
  });
}

void bootstrap();
