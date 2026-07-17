/**
 * Minimal inline email templates.
 * All templates return both HTML and plain-text versions.
 * No external template engine is needed at this stage.
 */

export interface EmailTemplate {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

interface BaseVars {
  orgName: string;
  footerUrl?: string;
}

export function approvalRequestTemplate(vars: BaseVars & {
  recipientName: string;
  toolName: string;
  agentName: string;
  taskDescription: string;
  approveUrl: string;
  rejectUrl: string;
  expiresIn: string;
}): EmailTemplate {
  return {
    subject: `[Action Required] Approve "${vars.toolName}" — ${vars.orgName}`,
    bodyHtml: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
  <div style="background:#4f46e5;padding:24px 32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">NexusOS — Action Required</h1>
  </div>
  <div style="padding:32px;background:#f8f9ff;border-radius:0 0 12px 12px">
    <p style="margin:0 0 16px">Hi ${vars.recipientName},</p>
    <p style="margin:0 0 16px">
      <strong>${vars.agentName}</strong> is requesting permission to run the tool
      <strong>${vars.toolName}</strong> as part of the task:
    </p>
    <blockquote style="border-left:4px solid #4f46e5;margin:0 0 24px;padding:12px 16px;background:#eef2ff;border-radius:0 8px 8px 0;color:#3730a3">
      ${vars.taskDescription}
    </blockquote>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
      This approval expires in <strong>${vars.expiresIn}</strong>.
    </p>
    <div style="display:flex;gap:12px">
      <a href="${vars.approveUrl}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
        Approve
      </a>
      <a href="${vars.rejectUrl}" style="display:inline-block;padding:12px 28px;background:#ef4444;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;margin-left:12px">
        Reject
      </a>
    </div>
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
      ${vars.orgName} · NexusOS · <a href="${vars.footerUrl ?? '#'}" style="color:#6b7280">Manage notifications</a>
    </p>
  </div>
</div>`.trim(),
    bodyText: `
Action Required — ${vars.orgName}

Hi ${vars.recipientName},

${vars.agentName} is requesting permission to run: ${vars.toolName}

Task: ${vars.taskDescription}

Approve: ${vars.approveUrl}
Reject:  ${vars.rejectUrl}

This approval expires in ${vars.expiresIn}.

— NexusOS
`.trim(),
  };
}

export function draftApprovedTemplate(vars: BaseVars & {
  recipientName: string;
  subject: string;
  previewText: string;
}): EmailTemplate {
  return {
    subject: `Email draft approved: "${vars.subject}"`,
    bodyHtml: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
  <div style="padding:24px 32px;background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0">
    <h2 style="margin:0 0 8px;color:#15803d">Draft approved &amp; sent</h2>
    <p style="margin:0 0 16px">Hi ${vars.recipientName}, your draft "<strong>${vars.subject}</strong>" was approved and sent.</p>
    <p style="margin:0;font-size:14px;color:#6b7280">Preview: ${vars.previewText.slice(0, 120)}…</p>
  </div>
</div>`.trim(),
    bodyText: `Draft approved & sent\n\nHi ${vars.recipientName},\n\nYour draft "${vars.subject}" was approved and sent.\n\n— NexusOS`,
  };
}

export function invitationTemplate(vars: BaseVars & {
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresIn: string;
}): EmailTemplate {
  return {
    subject: `You're invited to join ${vars.orgName} on NexusOS`,
    bodyHtml: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#4f46e5;padding:24px 32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">You've been invited</h1>
  </div>
  <div style="padding:32px;background:#f8f9ff;border-radius:0 0 12px 12px">
    <p><strong>${vars.inviterName}</strong> invited you to join <strong>${vars.orgName}</strong> as <strong>${vars.role}</strong>.</p>
    <a href="${vars.acceptUrl}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
      Accept Invitation
    </a>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Expires in ${vars.expiresIn}.</p>
  </div>
</div>`.trim(),
    bodyText: `You're invited to join ${vars.orgName}\n\n${vars.inviterName} invited you as ${vars.role}.\n\nAccept: ${vars.acceptUrl}\n\nExpires in ${vars.expiresIn}.`,
  };
}
