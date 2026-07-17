'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface ChildOrg {
  id: string;
  name: string;
  slug: string;
  industry: string;
  plan: string;
  status: string;
  createdAt: string;
  settings: Record<string, unknown>;
  _count: { memberships: number; agents: number; agentRuns: number };
}

interface Dashboard {
  totalChildren: number;
  byStatus: Record<string, number>;
  monthlySpendUsd: number;
  topActiveOrgs: Array<{ id: string; name: string; slug: string; agentRunCount: number }>;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  trial: 'bg-blue-500/20 text-blue-400',
  suspended: 'bg-red-500/20 text-red-400',
};

const PLAN_STYLE: Record<string, string> = {
  starter: 'bg-gray-700 text-gray-300',
  growth: 'bg-indigo-500/20 text-indigo-300',
  enterprise: 'bg-amber-500/20 text-amber-300',
};

const INDUSTRIES = ['other', 'saas', 'ecommerce', 'consulting', 'agency', 'finance', 'healthcare', 'education', 'real_estate'];

export default function AgencyPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [orgs, setOrgs] = useState<ChildOrg[]>([]);
  const [showProvision, setShowProvision] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', slug: '', industry: 'other', plan: 'starter',
    whitelabelEnabled: false, customDomain: '', primaryColor: '',
  });

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    void apiRequest<ChildOrg[]>(`/orgs/${orgId}/agency/orgs`).then(setOrgs).catch(() => {});
    void apiRequest<Dashboard>(`/orgs/${orgId}/agency/dashboard`).then(setDashboard).catch(() => {});
  };

  useEffect(load, [orgId]);

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function provision() {
    if (!orgId || !form.name.trim() || !form.slug.trim()) return;
    setProvisioning(true);
    try {
      await apiRequest(`/orgs/${orgId}/agency/orgs`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          customDomain: form.customDomain || undefined,
          primaryColor: form.primaryColor || undefined,
        }),
      });
      setForm({ name: '', slug: '', industry: 'other', plan: 'starter', whitelabelEnabled: false, customDomain: '', primaryColor: '' });
      setShowProvision(false);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to provision org';
      alert(msg);
    } finally { setProvisioning(false); }
  }

  async function suspend(childId: string) {
    if (!orgId) return;
    setActing(childId);
    try {
      await apiRequest(`/orgs/${orgId}/agency/orgs/${childId}/suspend`, { method: 'POST', body: '{}' });
      load();
    } catch { alert('Failed to suspend'); }
    finally { setActing(null); }
  }

  async function reactivate(childId: string) {
    if (!orgId) return;
    setActing(childId);
    try {
      await apiRequest(`/orgs/${orgId}/agency/orgs/${childId}/reactivate`, { method: 'POST', body: '{}' });
      load();
    } catch { alert('Failed to reactivate'); }
    finally { setActing(null); }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Agency</h1>
          <p className="mt-1 text-sm text-gray-400">Manage client organizations from a single pane of glass</p>
        </div>
        <button onClick={() => setShowProvision(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + Provision Client Org
        </button>
      </div>

      {/* Dashboard summary */}
      {dashboard && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Managed Orgs</p>
            <p className="mt-1 text-2xl font-bold text-white">{dashboard.totalChildren}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Active</p>
            <p className="mt-1 text-2xl font-bold text-green-400">{dashboard.byStatus['active'] ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Suspended</p>
            <p className="mt-1 text-2xl font-bold text-red-400">{dashboard.byStatus['suspended'] ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Network Spend (mo)</p>
            <p className="mt-1 text-2xl font-bold text-white">${dashboard.monthlySpendUsd.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Top active orgs */}
      {dashboard && dashboard.topActiveOrgs.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Most Active This Month</h2>
          <div className="space-y-2">
            {dashboard.topActiveOrgs.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{o.name ?? o.slug}</span>
                <span className="text-gray-500">{o.agentRunCount} runs</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Org list */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Client Organizations ({orgs.length})
        </h2>
        <div className="space-y-3">
          {orgs.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
              No client organizations yet. Provision one to get started.
            </div>
          )}
          {orgs.map((org) => (
            <div key={org.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[org.status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {org.status}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PLAN_STYLE[org.plan] ?? 'bg-gray-700 text-gray-300'}`}>
                      {org.plan}
                    </span>
                    {(org.settings as Record<string, unknown>)?.whitelabelEnabled && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-400">White-label</span>
                    )}
                  </div>
                  <h3 className="mt-2 font-semibold text-white">{org.name}</h3>
                  <p className="text-xs text-gray-500">/{org.slug} · {org.industry}</p>
                  <div className="mt-2 flex gap-4 text-xs text-gray-500 flex-wrap">
                    <span>{org._count.memberships} members</span>
                    <span>{org._count.agents} agents</span>
                    <span>{org._count.agentRuns} runs</span>
                    <span>Since {new Date(org.createdAt).toLocaleDateString()}</span>
                  </div>
                  {(org.settings as Record<string, unknown>)?.customDomain && (
                    <p className="mt-1 text-xs text-indigo-400">
                      {String((org.settings as Record<string, unknown>).customDomain)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {org.status === 'active' ? (
                    <button onClick={() => void suspend(org.id)} disabled={acting === org.id}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                      Suspend
                    </button>
                  ) : org.status === 'suspended' ? (
                    <button onClick={() => void reactivate(org.id)} disabled={acting === org.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-500 disabled:opacity-50">
                      Reactivate
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Provision modal */}
      {showProvision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white">Provision Client Organization</h2>

            <input placeholder="Organization name" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">/</span>
              <input placeholder="slug" value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <select value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {INDUSTRIES.map((i) => <option key={i} value={i} className="capitalize">{i.replace(/_/g, ' ')}</option>)}
            </select>

            <select value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {['starter', 'growth', 'enterprise'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.whitelabelEnabled}
                onChange={(e) => setForm((f) => ({ ...f, whitelabelEnabled: e.target.checked }))}
                className="accent-indigo-500" />
              Enable white-label branding
            </label>

            {form.whitelabelEnabled && (
              <>
                <input placeholder="Custom domain (e.g. app.client.com)" value={form.customDomain}
                  onChange={(e) => setForm((f) => ({ ...f, customDomain: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input placeholder="Primary color (e.g. #6366f1)" value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => void provision()} disabled={provisioning || !form.name.trim() || !form.slug.trim()}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {provisioning ? 'Provisioning…' : 'Provision'}
              </button>
              <button onClick={() => setShowProvision(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
