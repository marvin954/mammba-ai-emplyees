'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface AnalyticsSummary {
  period: { from: string; to: string };
  agentRuns: {
    total: number;
    completed: number;
    failed: number;
    avgDurationMs: number | null;
    totalCostUsd: number;
  };
  usage: {
    totalCostUsd: number;
    totalTokens: number;
    byProvider: Record<string, { costUsd: number; tokens: number }>;
    byModel: Record<string, { costUsd: number; tokens: number }>;
  };
  topAgents: Array<{ agentId: string; name: string; runs: number; costUsd: number }>;
  dailyRuns: Array<{ date: string; total: number; completed: number; failed: number; costUsd: number }>;
}

const DAYS_OPTIONS = [7, 14, 30, 90];

function BarChart({ data, max, colorClass }: { data: number[]; max: number; colorClass: string }) {
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t ${colorClass} transition-all`}
          style={{ height: max > 0 ? `${Math.round((v / max) * 100)}%` : '0%', minHeight: v > 0 ? '2px' : '0' }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    void apiRequest<AnalyticsSummary>(`/orgs/${orgId}/analytics/summary?days=${days}`)
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, days]);

  const successRate = summary
    ? summary.agentRuns.total > 0
      ? ((summary.agentRuns.completed / summary.agentRuns.total) * 100).toFixed(1)
      : '—'
    : '—';

  const dailyTotals = summary?.dailyRuns.map((d) => d.total) ?? [];
  const dailyMax = Math.max(...dailyTotals, 1);

  const topProviders = summary
    ? Object.entries(summary.usage.byProvider).sort((a, b) => b[1].costUsd - a[1].costUsd)
    : [];

  const topModels = summary
    ? Object.entries(summary.usage.byModel).sort((a, b) => b[1].costUsd - a[1].costUsd).slice(0, 5)
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-gray-400">Agent performance, usage costs, and trends</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-white/5 p-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${days === d ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && !summary && (
        <div className="py-20 text-center text-gray-500">Loading…</div>
      )}

      {summary && (
        <>
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-400">Total Runs</p>
              <p className="mt-1 text-2xl font-bold text-white">{summary.agentRuns.total.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-500">{successRate}% success rate</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-400">Failed Runs</p>
              <p className="mt-1 text-2xl font-bold text-red-400">{summary.agentRuns.failed.toLocaleString()}</p>
              <p className="mt-1 text-xs text-gray-500">of {summary.agentRuns.total} total</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-400">Avg Duration</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {summary.agentRuns.avgDurationMs
                  ? `${(summary.agentRuns.avgDurationMs / 1000).toFixed(1)}s`
                  : '—'}
              </p>
              <p className="mt-1 text-xs text-gray-500">per completed run</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-400">Total AI Cost</p>
              <p className="mt-1 text-2xl font-bold text-white">${summary.agentRuns.totalCostUsd.toFixed(2)}</p>
              <p className="mt-1 text-xs text-gray-500">{(summary.usage.totalTokens / 1000).toFixed(0)}k tokens</p>
            </div>
          </div>

          {/* Daily runs chart */}
          {summary.dailyRuns.length > 0 && (
            <section className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Daily Runs</h2>
              <BarChart data={dailyTotals} max={dailyMax} colorClass="bg-indigo-500/60" />
              <div className="mt-2 flex justify-between text-xs text-gray-600">
                <span>{summary.dailyRuns[0]?.date}</span>
                <span>{summary.dailyRuns[summary.dailyRuns.length - 1]?.date}</span>
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top agents */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Top Agents</h2>
              {summary.topAgents.length === 0 ? (
                <p className="text-sm text-gray-500">No runs in this period.</p>
              ) : (
                <div className="space-y-3">
                  {summary.topAgents.map((a) => (
                    <div key={a.agentId} className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-gray-300">{a.name}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{
                              width: `${Math.round((a.runs / (summary.topAgents[0]?.runs ?? 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-white">{a.runs} runs</p>
                        <p className="text-xs text-gray-500">${a.costUsd.toFixed(3)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Provider + model cost breakdown */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Cost by Provider</h2>
                {topProviders.length === 0 ? (
                  <p className="text-sm text-gray-500">No AI usage recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {topProviders.map(([name, stats]) => (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-gray-300">{name}</span>
                        <span className="text-gray-400">
                          ${stats.costUsd.toFixed(4)} · {(stats.tokens / 1000).toFixed(0)}k tok
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">Top Models</h2>
                <div className="space-y-2">
                  {topModels.map(([name, stats]) => (
                    <div key={name} className="flex items-center justify-between text-xs">
                      <span className="font-mono text-gray-400 truncate max-w-[60%]">{name}</span>
                      <span className="text-gray-500">${stats.costUsd.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
