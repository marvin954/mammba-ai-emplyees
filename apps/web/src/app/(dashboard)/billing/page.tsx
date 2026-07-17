'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string | null;
}

interface BillingState {
  subscription: Subscription | null;
  plan: string;
  status: string;
}

interface UsageSummary {
  period: { start: string; end: string };
  totalCostUsd: number;
  agentRunCount: number;
  recordCount: number;
  byProvider: Record<string, number>;
  byResourceType: Record<string, number>;
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$49',
    period: '/mo',
    features: ['3 AI employees', '1,000 agent runs/mo', 'CRM + email', '14-day free trial'],
    highlight: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$149',
    period: '/mo',
    features: ['10 AI employees', '10,000 agent runs/mo', 'All integrations', 'Knowledge RAG', 'Priority support'],
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited AI employees', 'Unlimited runs', 'SSO + audit logs', 'Dedicated SLA', 'Custom integrations'],
    highlight: false,
  },
];

const STATUS_COLOR: Record<string, string> = {
  active: 'text-green-400',
  trialing: 'text-blue-400',
  past_due: 'text-yellow-400',
  canceled: 'text-red-400',
  suspended: 'text-red-400',
};

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  useEffect(() => {
    if (!orgId) return;
    void apiRequest<BillingState>(`/orgs/${orgId}/billing/subscription`)
      .then(setBilling)
      .catch(() => {});
    void apiRequest<UsageSummary>(`/orgs/${orgId}/billing/usage`)
      .then(setUsage)
      .catch(() => {});
  }, [orgId]);

  async function startCheckout(plan: string) {
    if (!orgId) return;
    setLoading(true);
    try {
      const origin = window.location.origin;
      const { url } = await apiRequest<{ url: string }>(`/orgs/${orgId}/billing/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          plan,
          successUrl: `${origin}/billing?success=1`,
          cancelUrl: `${origin}/billing?canceled=1`,
        }),
      });
      window.location.href = url;
    } catch { alert('Failed to start checkout'); }
    finally { setLoading(false); }
  }

  async function openPortal() {
    if (!orgId) return;
    setLoading(true);
    try {
      const { url } = await apiRequest<{ url: string }>(`/orgs/${orgId}/billing/portal`, {
        method: 'POST',
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      window.location.href = url;
    } catch { alert('Failed to open billing portal'); }
    finally { setLoading(false); }
  }

  const currentPlan = billing?.plan ?? 'starter';
  const currentStatus = billing?.status ?? 'trial';

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your subscription and usage</p>
      </div>

      {/* Current plan summary */}
      {billing && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-gray-400">Current Plan</p>
              <p className="mt-0.5 text-xl font-semibold capitalize text-white">{currentPlan}</p>
              <p className={`mt-1 text-sm capitalize ${STATUS_COLOR[currentStatus] ?? 'text-gray-400'}`}>
                {currentStatus.replace(/_/g, ' ')}
                {billing.subscription?.cancelAtPeriodEnd && ' · Cancels at period end'}
                {billing.subscription?.trialEndsAt && (
                  <> · Trial ends {new Date(billing.subscription.trialEndsAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
            {billing.subscription && (
              <button
                onClick={() => void openPortal()}
                disabled={loading}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
              >
                Manage Subscription
              </button>
            )}
          </div>
        </section>
      )}

      {/* Usage summary */}
      {usage && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">This Month's Usage</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-400">Total Cost</p>
              <p className="mt-1 text-2xl font-bold text-white">${usage.totalCostUsd.toFixed(4)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-400">Agent Runs</p>
              <p className="mt-1 text-2xl font-bold text-white">{usage.agentRunCount.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-400">Usage Records</p>
              <p className="mt-1 text-2xl font-bold text-white">{usage.recordCount.toLocaleString()}</p>
            </div>
          </div>

          {Object.keys(usage.byProvider).length > 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-sm font-medium text-gray-400">By Provider</p>
              <div className="space-y-2">
                {Object.entries(usage.byProvider).map(([provider, cost]) => (
                  <div key={provider} className="flex justify-between text-sm">
                    <span className="capitalize text-gray-300">{provider}</span>
                    <span className="text-white">${(cost as number).toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Plan cards */}
      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-gray-400">Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col ${
                  plan.highlight
                    ? 'border-indigo-500/50 bg-indigo-600/10'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                {plan.highlight && (
                  <span className="mb-3 self-start rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">
                    Popular
                  </span>
                )}
                <h3 className="font-semibold text-white">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm text-gray-400">{plan.period}</span>
                </div>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-0.5 text-green-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => void startCheckout(plan.id)}
                  disabled={isCurrent || loading || plan.price === 'Custom'}
                  className={`mt-6 rounded-lg py-2 text-sm font-medium transition-colors ${
                    isCurrent
                      ? 'cursor-default bg-white/10 text-gray-500'
                      : plan.price === 'Custom'
                      ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                      : plan.highlight
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                      : 'border border-white/10 text-white hover:bg-white/10'
                  } disabled:opacity-50`}
                >
                  {isCurrent ? 'Current Plan' : plan.price === 'Custom' ? 'Contact Sales' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
