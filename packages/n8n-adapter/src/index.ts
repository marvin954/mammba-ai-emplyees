/**
 * n8n Adapter
 *
 * Bridges NexusOS workflow trigger requests to the n8n REST API.
 * n8n is not re-implemented here — this adapter proxies execution requests,
 * maps tenant credentials, validates webhook signatures, and normalises
 * execution results.
 *
 * Security model:
 * - API key is held server-side only; never sent to browsers
 * - Tenant credentials are passed as n8n credential references, not raw values
 * - Webhook payloads are validated via HMAC-SHA256 signature
 * - All executions are logged with idempotency keys
 */

import { createHmac, timingSafeEqual } from 'crypto';

export { leadToAppointmentWorkflow } from './templates/index.js';

export interface N8nTriggerInput {
  workflowId: string;
  orgId: string;
  agentRunId?: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface N8nExecutionResult {
  executionId: string;
  status: 'running' | 'success' | 'error' | 'unknown';
  data?: Record<string, unknown>;
  error?: string;
}

export class N8nAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly webhookSecret: string,
  ) {}

  async triggerWorkflow(input: N8nTriggerInput): Promise<N8nExecutionResult> {
    const url = `${this.baseUrl}/api/v1/workflows/${input.workflowId}/execute`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': this.apiKey,
        'X-Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        ...input.payload,
        _meta: {
          orgId: input.orgId,
          agentRunId: input.agentRunId,
          idempotencyKey: input.idempotencyKey,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n trigger failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { data?: { executionId?: string } };
    return {
      executionId: String(data.data?.executionId ?? 'unknown'),
      status: 'running',
    };
  }

  async getExecution(executionId: string): Promise<N8nExecutionResult> {
    const url = `${this.baseUrl}/api/v1/executions/${executionId}`;
    const response = await fetch(url, {
      headers: { 'X-N8N-API-KEY': this.apiKey },
    });

    if (!response.ok) {
      return { executionId, status: 'unknown' };
    }

    const data = await response.json() as { data?: { finished?: boolean; stoppedAt?: string; status?: string } };
    const exec = data.data;
    const finished = exec?.finished ?? false;
    const status = finished
      ? exec?.stoppedAt
        ? 'success'
        : 'error'
      : 'running';

    return { executionId, status };
  }

  /**
   * Validate an incoming webhook from n8n.
   * Returns false if the signature does not match — caller should return 401.
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    const expected = createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    const expectedBuf = Buffer.from(`sha256=${expected}`);
    const actualBuf = Buffer.from(signature);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  /**
   * Build the URL for a webhook trigger endpoint in n8n.
   * Used when configuring templates that fire on incoming events.
   */
  webhookUrl(path: string): string {
    return `${this.baseUrl}/webhook/${path}`;
  }

  /**
   * Import a workflow template JSON into n8n and return the created workflow ID.
   * The workflow is created inactive — activation is a separate step.
   */
  async importWorkflow(definition: Record<string, unknown>): Promise<string> {
    const url = `${this.baseUrl}/api/v1/workflows`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': this.apiKey,
      },
      body: JSON.stringify(definition),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`n8n workflow import failed (${response.status}): ${err}`);
    }

    const data = await response.json() as { data?: { id?: string } };
    return String(data.data?.id ?? 'unknown');
  }

  /**
   * Activate a workflow in n8n (sets active = true).
   */
  async activateWorkflow(workflowId: string): Promise<void> {
    const url = `${this.baseUrl}/api/v1/workflows/${workflowId}/activate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': this.apiKey },
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`n8n workflow activation failed (${response.status}): ${err}`);
    }
  }

  /**
   * List all workflows visible to the API key.
   */
  async listWorkflows(): Promise<Array<{ id: string; name: string; active: boolean }>> {
    const url = `${this.baseUrl}/api/v1/workflows`;
    const response = await fetch(url, { headers: { 'X-N8N-API-KEY': this.apiKey } });
    if (!response.ok) return [];
    const data = await response.json() as { data?: Array<{ id: string; name: string; active: boolean }> };
    return data.data ?? [];
  }
}
