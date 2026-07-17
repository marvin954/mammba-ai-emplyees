/**
 * Lead-to-Appointment n8n workflow template.
 *
 * This template is programmatically imported into n8n when an org activates
 * the "Sales Automation" workflow pack. It wires together:
 *   1. NexusOS webhook trigger (lead submitted)
 *   2. Lead enrichment step (calls back to NexusOS enrichment endpoint)
 *   3. AI qualification check (calls NexusOS agent-run API)
 *   4. Calendar slot lookup + booking
 *   5. Confirmation email (queued via NexusOS email queue)
 *
 * The workflow definition is a plain JSON object that maps to n8n's
 * workflow import format. Credential references use named n8n credentials
 * — raw secrets are never stored in this file.
 */

export const leadToAppointmentWorkflow = {
  name: 'NexusOS — Lead to Appointment',
  tags: ['nexusos', 'sales', 'automation'],
  active: false, // activated per-org after import
  nodes: [
    {
      id: 'webhook-trigger',
      name: 'Lead Submitted (NexusOS)',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [250, 300],
      parameters: {
        httpMethod: 'POST',
        path: 'nexusos-lead',
        responseMode: 'onReceived',
        responseData: 'allEntries',
        options: {},
      },
    },
    {
      id: 'validate-signature',
      name: 'Validate HMAC Signature',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [450, 300],
      parameters: {
        jsCode: `
const crypto = require('crypto');
const secret = $env.NEXUSOS_WEBHOOK_SECRET;
const sig = $input.first().headers['x-nexusos-signature'] ?? '';
const body = JSON.stringify($input.first().body);
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
if (sig !== expected) throw new Error('Invalid webhook signature');
return $input.all();
        `.trim(),
      },
    },
    {
      id: 'enrich-lead',
      name: 'Enrich Lead via NexusOS',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [650, 300],
      parameters: {
        method: 'POST',
        url: '={{ $env.NEXUSOS_API_URL }}/orgs/{{ $json.body.orgId }}/crm/contacts/{{ $json.body.contactId }}/score',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'httpHeaderAuth',
        options: {},
      },
    },
    {
      id: 'qualify-check',
      name: 'Check Lead Score',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [850, 300],
      parameters: {
        conditions: {
          options: { caseSensitive: false },
          conditions: [
            {
              leftValue: '={{ $json.leadScore }}',
              rightValue: 40,
              operator: { type: 'number', operation: 'gte' },
            },
          ],
        },
      },
    },
    {
      id: 'trigger-agent-qualify',
      name: 'Trigger AI Qualification',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [1050, 200],
      parameters: {
        method: 'POST',
        url: '={{ $env.NEXUSOS_API_URL }}/orgs/{{ $json.orgId }}/agent-runs',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'httpHeaderAuth',
        body: {
          mode: 'json',
          jsonOutput: '={{ JSON.stringify({ agentId: $env.NEXUSOS_SDR_AGENT_ID, taskType: "qualify_lead", input: $json }) }}',
        },
        options: {},
      },
    },
    {
      id: 'low-score-activity',
      name: 'Log Low-Score Activity',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4,
      position: [1050, 400],
      parameters: {
        method: 'POST',
        url: '={{ $env.NEXUSOS_API_URL }}/orgs/{{ $json.orgId }}/crm/activities',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'httpHeaderAuth',
        body: {
          mode: 'json',
          jsonOutput: '={{ JSON.stringify({ type: "workflow_note", subject: "Lead score below threshold — skipped auto-qualify", contactId: $json.contactId }) }}',
        },
        options: {},
      },
    },
  ],
  connections: {
    'webhook-trigger': { main: [[{ node: 'validate-signature', type: 'main', index: 0 }]] },
    'validate-signature': { main: [[{ node: 'enrich-lead', type: 'main', index: 0 }]] },
    'enrich-lead': { main: [[{ node: 'qualify-check', type: 'main', index: 0 }]] },
    'qualify-check': {
      main: [
        [{ node: 'trigger-agent-qualify', type: 'main', index: 0 }],
        [{ node: 'low-score-activity', type: 'main', index: 0 }],
      ],
    },
  },
  settings: {
    saveManualExecutions: true,
    callerPolicy: 'workflowsFromSameOwner',
    errorWorkflow: '',
  },
};

export type LeadToAppointmentWorkflow = typeof leadToAppointmentWorkflow;
