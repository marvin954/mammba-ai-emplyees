/**
 * Lightweight in-process metrics — counters and histograms.
 * Designed to be scraped by the /metrics endpoint or flushed to an external store.
 * No external dependencies — just in-memory maps with optional periodic logging.
 */

export interface CounterSnapshot {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface HistogramSnapshot {
  name: string;
  labels: Record<string, string>;
  count: number;
  sum: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

function labelKey(labels: Record<string, string>): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}

class Counter {
  private readonly values = new Map<string, { labels: Record<string, string>; value: number }>();

  inc(labels: Record<string, string> = {}, amount = 1): void {
    const key = labelKey(labels);
    const existing = this.values.get(key);
    if (existing) {
      existing.value += amount;
    } else {
      this.values.set(key, { labels: { ...labels }, value: amount });
    }
  }

  snapshot(name: string): CounterSnapshot[] {
    return [...this.values.values()].map((v) => ({ name, labels: v.labels, value: v.value }));
  }

  reset(): void {
    this.values.clear();
  }
}

class Histogram {
  private readonly buckets = new Map<string, { labels: Record<string, string>; observations: number[] }>();

  observe(value: number, labels: Record<string, string> = {}): void {
    const key = labelKey(labels);
    const existing = this.buckets.get(key);
    if (existing) {
      existing.observations.push(value);
      // Keep at most 10k observations per label set to bound memory
      if (existing.observations.length > 10_000) existing.observations.shift();
    } else {
      this.buckets.set(key, { labels: { ...labels }, observations: [value] });
    }
  }

  snapshot(name: string): HistogramSnapshot[] {
    return [...this.buckets.values()].map(({ labels, observations }) => {
      const sorted = [...observations].sort((a, b) => a - b);
      const count = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      const p = (pct: number) => sorted[Math.floor((pct / 100) * count)] ?? 0;
      return {
        name,
        labels,
        count,
        sum,
        min: sorted[0] ?? 0,
        max: sorted[count - 1] ?? 0,
        p50: p(50),
        p95: p(95),
        p99: p(99),
      };
    });
  }
}

export class MetricsRegistry {
  private static readonly counters = new Map<string, Counter>();
  private static readonly histograms = new Map<string, Histogram>();

  static counter(name: string): Counter {
    let c = this.counters.get(name);
    if (!c) { c = new Counter(); this.counters.set(name, c); }
    return c;
  }

  static histogram(name: string): Histogram {
    let h = this.histograms.get(name);
    if (!h) { h = new Histogram(); this.histograms.set(name, h); }
    return h;
  }

  static snapshot(): { counters: CounterSnapshot[]; histograms: HistogramSnapshot[] } {
    const counters: CounterSnapshot[] = [];
    for (const [name, c] of this.counters) counters.push(...c.snapshot(name));
    const histograms: HistogramSnapshot[] = [];
    for (const [name, h] of this.histograms) histograms.push(...h.snapshot(name));
    return { counters, histograms };
  }

  /** Expose Prometheus-compatible text format for scraping. */
  static prometheusText(): string {
    const lines: string[] = [];
    const { counters, histograms } = this.snapshot();

    for (const c of counters) {
      const lblStr = Object.entries(c.labels).map(([k, v]) => `${k}="${v}"`).join(',');
      lines.push(`${c.name}${lblStr ? `{${lblStr}}` : ''} ${c.value}`);
    }
    for (const h of histograms) {
      const lblStr = Object.entries(h.labels).map(([k, v]) => `${k}="${v}"`).join(',');
      const lbl = lblStr ? `{${lblStr}}` : '';
      lines.push(`${h.name}_count${lbl} ${h.count}`);
      lines.push(`${h.name}_sum${lbl} ${h.sum}`);
      lines.push(`${h.name}_min${lbl} ${h.min}`);
      lines.push(`${h.name}_max${lbl} ${h.max}`);
      lines.push(`${h.name}_p50${lbl} ${h.p50}`);
      lines.push(`${h.name}_p95${lbl} ${h.p95}`);
      lines.push(`${h.name}_p99${lbl} ${h.p99}`);
    }
    return lines.join('\n');
  }
}

// Pre-defined platform metrics — imported by the worker and API to track key signals.
export const Metrics = {
  agentRunsTotal: MetricsRegistry.counter('nexusos_agent_runs_total'),
  agentRunDurationMs: MetricsRegistry.histogram('nexusos_agent_run_duration_ms'),
  agentRunCostUsd: MetricsRegistry.histogram('nexusos_agent_run_cost_usd'),
  toolCallsTotal: MetricsRegistry.counter('nexusos_tool_calls_total'),
  aiProviderRequestsTotal: MetricsRegistry.counter('nexusos_ai_provider_requests_total'),
  aiProviderErrorsTotal: MetricsRegistry.counter('nexusos_ai_provider_errors_total'),
  httpRequestsTotal: MetricsRegistry.counter('nexusos_http_requests_total'),
  httpRequestDurationMs: MetricsRegistry.histogram('nexusos_http_request_duration_ms'),
  queueJobsTotal: MetricsRegistry.counter('nexusos_queue_jobs_total'),
  circuitBreakerTripsTotal: MetricsRegistry.counter('nexusos_circuit_breaker_trips_total'),
};
