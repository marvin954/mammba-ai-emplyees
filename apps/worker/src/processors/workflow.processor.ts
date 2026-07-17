/**
 * Workflow trigger processor.
 *
 * Consumes WorkflowTriggerJob items from the WORKFLOWS queue and proxies them
 * to n8n via the N8nAdapter. Records the resulting n8n execution ID back on
 * the originating agent run (if present) for observability.
 */

import type { Job } from 'bullmq';
import type { PrismaClient } from '@nexusos/database';
import type { AuditService } from '@nexusos/audit';
import { N8nAdapter } from '@nexusos/n8n-adapter';
import type { WorkflowTriggerJob } from '@nexusos/events';

export class WorkflowProcessor {
  private readonly n8n: N8nAdapter;

  constructor(
    private readonly db: PrismaClient,
    private readonly audit: AuditService,
    n8nBaseUrl: string,
    n8nApiKey: string,
    n8nWebhookSecret: string,
  ) {
    this.n8n = new N8nAdapter(n8nBaseUrl, n8nApiKey, n8nWebhookSecret);
  }

  async process(job: Job): Promise<void> {
    const data = job.data as WorkflowTriggerJob;

    if (data.type !== 'workflow.trigger') {
      throw new Error(`Unexpected job type in workflows queue: ${String(data.type)}`);
    }

    const result = await this.n8n.triggerWorkflow({
      workflowId: data.workflowId,
      orgId: data.orgId,
      agentRunId: data.agentRunId,
      payload: data.input,
      idempotencyKey: data.idempotencyKey,
    });

    // Record execution ID on the agent run if one was provided
    if (data.agentRunId && result.executionId !== 'unknown') {
      await this.db.agentRun.update({
        where: { id: data.agentRunId },
        data: {
          metadata: {
            n8nExecutionId: result.executionId,
            n8nWorkflowId: data.workflowId,
          },
        },
      });
    }

    await this.audit.write({
      orgId: data.orgId,
      action: 'workflow.triggered',
      actorId: null,
      resourceType: 'workflow',
      resourceId: data.workflowId,
      metadata: {
        executionId: result.executionId,
        status: result.status,
        agentRunId: data.agentRunId ?? null,
        idempotencyKey: data.idempotencyKey,
      },
    });

    console.warn(
      `[WorkflowProcessor] Triggered n8n workflow ${data.workflowId} → execution ${result.executionId}`,
    );
  }
}
