'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface Plugin {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  category: string;
  version: string;
  requiredPlan: string;
  permissions: string[];
  tools: string[];
  tags: string[];
  iconUrl?: string | null;
  isOfficial: boolean;
  installCount: number;
  installed: boolean;
  status: string;
}

interface InstalledPlugin {
  id: string;
  pluginSlug: string;
  version: string;
  enabled: boolean;
  installedAt: string;
  plugin: {
    name: string;
    description: string;
    category: string;
    iconUrl?: string | null;
    isOfficial: boolean;
  };
}

const CATEGORY_ICON: Record<string, string> = {
  crm: '👥',
  marketing: '📣',
  support: '💬',
  finance: '💵',
  hr: '🧑‍💼',
  analytics: '📊',
  integration: '🔌',
  utility: '🔧',
};

const PLAN_STYLE: Record<string, string> = {
  starter: 'bg-gray-700 text-gray-300',
  growth: 'bg-indigo-500/20 text-indigo-300',
  enterprise: 'bg-amber-500/20 text-amber-300',
};

const CATEGORIES = ['all', 'crm', 'marketing', 'support', 'finance', 'hr', 'analytics', 'integration', 'utility'];

export default function MarketplacePage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [detail, setDetail] = useState<Plugin | null>(null);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (search.trim()) params.set('search', search.trim());
    const q = params.toString() ? `?${params.toString()}` : '';
    void apiRequest<{ data: Plugin[] }>(`/marketplace/plugins${q}`)
      .then((r) => setPlugins(r.data)).catch(() => {});
    void apiRequest<InstalledPlugin[]>(`/orgs/${orgId}/plugins`)
      .then(setInstalled).catch(() => {});
  };

  useEffect(load, [orgId, category]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function install(slug: string) {
    if (!orgId) return;
    setActing(slug);
    try {
      await apiRequest(`/orgs/${orgId}/plugins/${slug}`, { method: 'POST', body: '{}' });
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to install plugin';
      alert(msg);
    } finally { setActing(null); }
  }

  async function uninstall(slug: string) {
    if (!orgId || !confirm(`Uninstall ${slug}?`)) return;
    setActing(slug);
    try {
      await apiRequest(`/orgs/${orgId}/plugins/${slug}`, { method: 'DELETE' });
      load();
    } catch { alert('Failed to uninstall'); }
    finally { setActing(null); }
  }

  const installedSlugs = new Set(installed.map((i) => i.pluginSlug));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketplace</h1>
        <p className="mt-1 text-sm text-gray-400">Extend NexusOS with plugins built on the EvoNexus v2 platform</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1 w-fit">
        {(['browse', 'installed'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${activeTab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t}{t === 'installed' && installed.length > 0 && ` (${installed.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Search + category */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <input
              placeholder="Search plugins…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${category === c ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                {c !== 'all' && `${CATEGORY_ICON[c] ?? ''} `}{c}
              </button>
            ))}
          </div>

          {/* Plugin grid */}
          {plugins.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
              No plugins found{search ? ` for "${search}"` : ''}.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plugins.map((p) => {
                const isInstalled = installedSlugs.has(p.slug) || p.installed;
                return (
                  <div key={p.slug} className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{CATEGORY_ICON[p.category] ?? '🔌'}</span>
                        <div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <h3 className="font-semibold text-white text-sm">{p.name}</h3>
                            {p.isOfficial && (
                              <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">Official</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">by {p.author} · v{p.version}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize shrink-0 ${PLAN_STYLE[p.requiredPlan] ?? 'bg-gray-700 text-gray-300'}`}>
                        {p.requiredPlan}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 flex-1">{p.description}</p>

                    {p.tools.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.tools.slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-gray-500">{t}</span>
                        ))}
                        {p.tools.length > 3 && <span className="text-xs text-gray-600">+{p.tools.length - 3} more</span>}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button onClick={() => setDetail(p)} className="text-xs text-indigo-400 hover:text-indigo-300">Details</button>
                      <button
                        onClick={() => isInstalled ? void uninstall(p.slug) : void install(p.slug)}
                        disabled={acting === p.slug}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          isInstalled
                            ? 'border border-white/10 text-gray-400 hover:text-red-400'
                            : 'bg-indigo-600 text-white hover:bg-indigo-500'
                        }`}
                      >
                        {acting === p.slug ? '…' : isInstalled ? 'Uninstall' : 'Install'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'installed' && (
        <div className="space-y-3">
          {installed.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
              No plugins installed yet.
            </div>
          ) : (
            installed.map((i) => (
              <div key={i.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CATEGORY_ICON[i.plugin.category] ?? '🔌'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{i.plugin.name}</p>
                        {i.plugin.isOfficial && <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">Official</span>}
                      </div>
                      <p className="text-xs text-gray-500">v{i.version} · Installed {new Date(i.installedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button onClick={() => void uninstall(i.pluginSlug)} disabled={acting === i.pluginSlug}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 disabled:opacity-50">
                    {acting === i.pluginSlug ? '…' : 'Uninstall'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gray-900 p-6 max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-white">{detail.name}</h2>
                  {detail.isOfficial && <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">Official</span>}
                </div>
                <p className="text-sm text-gray-400">by {detail.author} · v{detail.version} · {detail.category}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            <p className="text-sm text-gray-300">{detail.description}</p>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Permissions Required</p>
              <div className="flex flex-wrap gap-1">
                {detail.permissions.map((p) => (
                  <span key={p} className="rounded bg-white/5 px-2 py-0.5 text-xs text-gray-400">{p}</span>
                ))}
              </div>
            </div>

            {detail.tools.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Adds {detail.tools.length} Tool{detail.tools.length > 1 ? 's' : ''}</p>
                <div className="flex flex-wrap gap-1">
                  {detail.tools.map((t) => (
                    <span key={t} className="rounded bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {(installedSlugs.has(detail.slug) || detail.installed) ? (
                <button onClick={() => { void uninstall(detail.slug); setDetail(null); }}
                  className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-gray-400 hover:text-red-400">
                  Uninstall
                </button>
              ) : (
                <button onClick={() => { void install(detail.slug); setDetail(null); }}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                  Install
                </button>
              )}
              <button onClick={() => setDetail(null)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
