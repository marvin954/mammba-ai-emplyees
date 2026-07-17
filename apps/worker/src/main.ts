import { PrismaClient } from '@nexusos/database';
import { AiGateway } from '@nexusos/ai-core';
import { AgentRunner, ToolRegistry, registerBuiltinTools } from '@nexusos/agent-runtime';
import { AuditService } from '@nexusos/audit';
import { QUEUE_NAMES } from '@nexusos/events';
import { AgentRunProcessor } from './processors/agent-run.processor.js';
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
  const runner = new AgentRunner(db, gateway, registry, audit);
  const agentRunProcessor = new AgentRunProcessor(runner);

  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redisConfig = {
    host: new URL(redisUrl).hostname,
    port: Number(new URL(redisUrl).port || 6379),
    maxRetriesPerRequest: null as null,
  };

  const concurrency = Number(process.env['WORKER_CONCURRENCY'] ?? 4);

  const agentRunWorker = createWorker(
    QUEUE_NAMES.AGENT_RUNS,
    (job) => agentRunProcessor.process(job),
    redisConfig,
    concurrency,
  );

  agentRunWorker.on('completed', (job) => {
    console.warn(`[Worker] Job ${job.id} completed`);
  });

  agentRunWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  console.warn(`[Worker] Listening on queues: ${Object.values(QUEUE_NAMES).join(', ')}`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.warn('[Worker] SIGTERM received — closing gracefully');
    await agentRunWorker.close();
    await db.$disconnect();
    process.exit(0);
  });
}

void bootstrap();
