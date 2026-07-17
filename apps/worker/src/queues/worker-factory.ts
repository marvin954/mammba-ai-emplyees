import { Worker, type Job } from 'bullmq';

interface RedisConfig {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
}

export function createWorker(
  queueName: string,
  processor: (job: Job) => Promise<unknown>,
  redis: RedisConfig,
  concurrency: number,
): Worker {
  return new Worker(queueName, processor, {
    connection: redis,
    concurrency,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
}

export function createQueue(queueName: string, redis: RedisConfig) {
  // Import dynamically to avoid loading BullMQ in non-worker contexts
  const { Queue } = require('bullmq') as typeof import('bullmq');
  return new Queue(queueName, { connection: redis });
}
