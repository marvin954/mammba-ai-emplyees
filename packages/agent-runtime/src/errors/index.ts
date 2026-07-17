export class AgentRunError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly runId: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'AgentRunError';
  }
}

export class ToolNotAllowedError extends AgentRunError {
  constructor(toolName: string, runId: string) {
    super(
      `Tool "${toolName}" is not in the agent's allowlist`,
      'TOOL_NOT_ALLOWED',
      runId,
      false,
    );
    this.name = 'ToolNotAllowedError';
  }
}

export class ApprovalRequiredError extends AgentRunError {
  constructor(runId: string, public readonly approvalId: string) {
    super('Action requires human approval before proceeding', 'APPROVAL_REQUIRED', runId, false);
    this.name = 'ApprovalRequiredError';
  }
}

export class RunTimeoutError extends AgentRunError {
  constructor(runId: string) {
    super('Agent run exceeded maximum execution time', 'TIMEOUT', runId, true);
    this.name = 'RunTimeoutError';
  }
}
