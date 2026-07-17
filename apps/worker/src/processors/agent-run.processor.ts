import type { Job } from 'bullmq';
import type { AgentRunner } from '@nexusos/agent-runtime';
import type { AgentRunQueueJob } from '@nexusos/events';
import { Metrics } from '@nexusos/observability';

export class AgentRunProcessor {
  constructor(private readonly runner: AgentRunner) {}

  async process(job: Job): Promise<unknown> {
    const data = job.data as AgentRunQueueJob;

    if (data.type !== 'agent.run') {
      throw new Error(`Unexpected job type in agent-runs queue: ${String(data.type)}`);
    }

    const start = Date.now();
    Metrics.agentRunsTotal.inc({ orgId: data.orgId, status: 'started' });

    try {
      const result = await this.runner.run({
        agentRunId: data.agentRunId,
        orgId: data.orgId,
        agentId: data.agentId,
        taskType: data.taskType,
        input: data.input,
        initiatedById: data.initiatedById,
      });
      const durationMs = Date.now() - start;
      Metrics.agentRunsTotal.inc({ orgId: data.orgId, status: 'completed' });
      Metrics.agentRunDurationMs.observe(durationMs, { orgId: data.orgId });
      return result;
    } catch (err) {
      Metrics.agentRunsTotal.inc({ orgId: data.orgId, status: 'failed' });
      throw err;
    }
  }
}
