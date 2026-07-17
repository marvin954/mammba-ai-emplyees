export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** failures before opening */
  failureThreshold?: number;
  /** ms to wait before trying HALF_OPEN */
  resetTimeoutMs?: number;
  /** success calls in HALF_OPEN needed to close */
  halfOpenSuccessThreshold?: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly name: string, public readonly retryAfterMs: number) {
    super(`Circuit breaker "${name}" is OPEN. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private halfOpenSuccesses = 0;
  private openedAt = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenSuccessThreshold: number;

  constructor(
    public readonly name: string,
    opts: CircuitBreakerOptions = {},
  ) {
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;
    this.halfOpenSuccessThreshold = opts.halfOpenSuccessThreshold ?? 2;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed < this.resetTimeoutMs) {
        throw new CircuitBreakerOpenError(this.name, this.resetTimeoutMs - elapsed);
      }
      this.state = 'HALF_OPEN';
      this.halfOpenSuccesses = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.halfOpenSuccessThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount += 1;
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failureCount: number; openedAt: number | null } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      openedAt: this.state !== 'CLOSED' ? this.openedAt : null,
    };
  }
}

/** Singleton registry — one breaker per provider name */
export class CircuitBreakerRegistry {
  private static readonly breakers = new Map<string, CircuitBreaker>();

  static get(name: string, opts?: CircuitBreakerOptions): CircuitBreaker {
    let cb = this.breakers.get(name);
    if (!cb) {
      cb = new CircuitBreaker(name, opts);
      this.breakers.set(name, cb);
    }
    return cb;
  }

  static getAll(): Record<string, ReturnType<CircuitBreaker['getStats']>> {
    const out: Record<string, ReturnType<CircuitBreaker['getStats']>> = {};
    for (const [name, cb] of this.breakers) {
      out[name] = cb.getStats();
    }
    return out;
  }
}
