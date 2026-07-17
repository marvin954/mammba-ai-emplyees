import type { Job } from 'bullmq';
import type { AgentRunner } from '@nexusos/agent-runtime';
import type { AgentRunQueueJob } from '@nexusos/events';

export class AgentRunProcessor {
  constructor(private readonly runner: AgentRunner) {}

  async process(job: Job): Promise<unknown> {
    const data = job.data as AgentRunQueueJob;

    if (data.type !== 'agent.run') {
      throw new Error(`Unexpected job type in agent-runs queue: ${String(data.type)}`);
    }

    return this.runner.run({
      agentRunId: data.agentRunId,
      orgId: data.orgId,
      agentId: data.agentId,
      taskType: data.taskType,
      input: data.input,
      initiatedById: data.initiatedById,
    });
  }
}
