'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string | null;
  goal?: string | null;
  budget?: number | null;
  spend: number;
  startDate?: string | null;
  endDate?: string | null;
  metrics: Record<string, unknown>;
  createdAt: string;
  _count: { assets: number };
}

interface CampaignAsset {
  id: string;
  type: string;
  name: string;
  content: string;
  status: string;
}

interface CampaignDetail extends Campaign {
  assets: CampaignAsset[];
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalSpend: number;
  totalBudget: number;
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-700 text-gray-300',
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-blue-500/20 text-blue-400',
  archived: 'bg-gray-800 text-gray-500',
};

const TYPE_ICON: Record<string, string> = {
  email: '✉️',
  social: '📱',
  content: '📝',
  paid: '💰',
  event: '🎪',
};

const CAMPAIGN_TYPES = ['email', 'social', 'content', 'paid', 'event'];

export default function MarketingPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<CampaignDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'email', goal: '', budget: '' });

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    void apiRequest<{ data: Campaign[] }>(`/orgs/${orgId}/marketing/campaigns${statusFilter !== 'all' ? `?status=${statusFilter}` : ''}`)
      .then((r) => setCampaigns(r.data))
      .catch(() => {});
    void apiRequest<Summary>(`/orgs/${orgId}/marketing/summary`).then(setSummary).catch(() => {});
  };

  useEffect(load, [orgId, statusFilter]);

  async function openCampaign(id: string) {
    if (!orgId) return;
    const data = await apiRequest<CampaignDetail>(`/orgs/${orgId}/marketing/campaigns/${id}`);
    setSelected(data);
  }

  async function createCampaign() {
    if (!orgId || !form.name.trim()) return;
    setCreating(true);
    try {
      await apiRequest(`/orgs/${orgId}/marketing/campaigns`, {
        method: 'POST',
        body: JSON.stringify({ name: form.name, type: form.type, goal: form.goal || undefined, budget: form.budget ? Number(form.budget) : undefined }),
      });
      setForm({ name: '', type: 'email', goal: '', budget: '' });
      setShowCreate(false);
      load();
    } catch { alert('Failed to create campaign'); }
    finally { setCreating(false); }
  }

  async function updateStatus(campaignId: string, status: string) {
    if (!orgId) return;
    await apiRequest(`/orgs/${orgId}/marketing/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    load();
    if (selected?.id === campaignId) setSelected(null);
  }

  const statuses = ['all', 'draft', 'active', 'paused', 'completed', 'archived'];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing</h1>
          <p className="mt-1 text-sm text-gray-400">Manage campaigns and AI-generated content</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + New Campaign
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Total Campaigns</p>
            <p className="mt-1 text-2xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Active</p>
            <p className="mt-1 text-2xl font-bold text-green-400">{summary.byStatus['active'] ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Total Spend</p>
            <p className="mt-1 text-2xl font-bold text-white">${summary.totalSpend.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Total Budget</p>
            <p className="mt-1 text-2xl font-bold text-white">${summary.totalBudget.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Campaign list */}
      <div className="space-y-3">
        {campaigns.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
            No campaigns yet. Create one to get started.
          </div>
        )}
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{TYPE_ICON[c.type] ?? '📋'}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {c.status}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{c.type}</span>
                </div>
                <h3 className="mt-2 font-semibold text-white">{c.name}</h3>
                {c.goal && <p className="mt-0.5 text-sm text-gray-400">{c.goal}</p>}
                <div className="mt-2 flex gap-4 text-xs text-gray-500 flex-wrap">
                  <span>{c._count.assets} assets</span>
                  {c.budget && <span>Budget: ${c.budget.toLocaleString()}</span>}
                  {c.spend > 0 && <span>Spent: ${c.spend.toLocaleString()}</span>}
                  <span>Created {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => void openCampaign(c.id)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/10"
                >
                  View
                </button>
                {c.status === 'draft' && (
                  <button
                    onClick={() => void updateStatus(c.id, 'active')}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-500"
                  >
                    Launch
                  </button>
                )}
                {c.status === 'active' && (
                  <button
                    onClick={() => void updateStatus(c.id, 'paused')}
                    className="rounded-lg bg-yellow-600/80 px-3 py-1.5 text-xs text-white hover:bg-yellow-600"
                  >
                    Pause
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">New Campaign</h2>
            <input
              placeholder="Campaign name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CAMPAIGN_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
            <input
              placeholder="Goal (optional)"
              value={form.goal}
              onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              placeholder="Budget USD (optional)"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => void createCampaign()}
                disabled={creating || !form.name.trim()}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900 p-6 max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
                <p className="text-sm text-gray-400 capitalize">{selected.type} campaign · {selected.status}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            {selected.goal && <p className="text-sm text-gray-300">{selected.goal}</p>}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Assets ({selected.assets.length})</h3>
              {selected.assets.length === 0 ? (
                <p className="text-sm text-gray-500">No assets yet — assign an AI employee to generate them.</p>
              ) : (
                <div className="space-y-2">
                  {selected.assets.map((a) => (
                    <div key={a.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-300 capitalize">{a.type.replace(/_/g, ' ')} · {a.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[a.status] ?? 'bg-gray-700 text-gray-300'}`}>{a.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{a.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
