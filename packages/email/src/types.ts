export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromName: string;
  fromAddress: string;
}

export interface SendEmailInput {
  to: string | string[];
  cc?: string | string[];
  replyTo?: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  /** Caller-supplied idempotency key — logged but not enforced at transport level */
  idempotencyKey?: string;
}

export interface SendEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}
