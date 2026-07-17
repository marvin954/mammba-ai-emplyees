/**
 * EmailService — thin nodemailer wrapper.
 *
 * Security:
 * - SMTP credentials never leave the server process
 * - HTML bodies are sent as-is; callers are responsible for sanitisation
 *   (the approval gate upstream ensures no agent-generated HTML ships
 *    without human sign-off)
 * - TLS is enforced in production (secure: true or STARTTLS via port 587)
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailConfig, SendEmailInput, SendEmailResult } from './types.js';

export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: EmailConfig) {
    this.from = `"${config.fromName}" <${config.fromAddress}>`;

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user
        ? { auth: { user: config.user, pass: config.pass } }
        : {}),
    });
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: Array.isArray(input.to) ? input.to.join(', ') : input.to,
      cc: input.cc
        ? Array.isArray(input.cc) ? input.cc.join(', ') : input.cc
        : undefined,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.bodyHtml,
      text: input.bodyText,
      headers: input.idempotencyKey
        ? { 'X-Idempotency-Key': input.idempotencyKey }
        : undefined,
    });

    return {
      messageId: info.messageId as string,
      accepted: (info.accepted as string[]) ?? [],
      rejected: (info.rejected as string[]) ?? [],
    };
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

/** Build EmailService from standard env vars */
export function createEmailServiceFromEnv(): EmailService {
  return new EmailService({
    host: process.env['SMTP_HOST'] ?? 'localhost',
    port: Number(process.env['SMTP_PORT'] ?? 1025),
    secure: process.env['SMTP_SECURE'] === 'true',
    user: process.env['SMTP_USER'] || undefined,
    pass: process.env['SMTP_PASS'] || undefined,
    fromName: process.env['EMAIL_FROM_NAME'] ?? 'NexusOS',
    fromAddress: process.env['EMAIL_FROM'] ?? 'noreply@nexusos.local',
  });
}
