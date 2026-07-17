export class AiGatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiGatewayError';
  }
}

export class ProviderRateLimitError extends AiGatewayError {
  constructor(provider: string, public readonly retryAfterMs?: number) {
    super(`Rate limit exceeded for provider: ${provider}`, 'RATE_LIMIT', provider, true);
    this.name = 'ProviderRateLimitError';
  }
}

export class ProviderUnavailableError extends AiGatewayError {
  constructor(provider: string) {
    super(`Provider unavailable: ${provider}`, 'PROVIDER_UNAVAILABLE', provider, true);
    this.name = 'ProviderUnavailableError';
  }
}

export class BudgetExceededError extends AiGatewayError {
  constructor(orgId: string) {
    super(`Monthly AI budget exceeded for org: ${orgId}`, 'BUDGET_EXCEEDED', 'system', false);
    this.name = 'BudgetExceededError';
  }
}
