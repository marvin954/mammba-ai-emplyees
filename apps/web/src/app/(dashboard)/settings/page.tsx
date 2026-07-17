'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  industry: string;
  plan: string;
  status: string;
  logoUrl: string | null;
  domain: string | null;
  settings: Record<string, unknown>;
}

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface Credential {
  id: string;
  name: string;
  provider: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-400',
  admin: 'bg-blue-500/20 text-blue-400',
  member: 'bg-gray-700 text-gray-300',
  viewer: 'bg-gray-800 text-gray-500',
};

const INDUSTRIES = ['other', 'saas', 'ecommerce', 'consulting', 'agency', 'finance', 'healthcare', 'education', 'real_estate'];

export default function SettingsPage() {
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [tab, setTab] = useState<'org' | 'members' | 'credentials'>('org');
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Org form state
  const [orgForm, setOrgForm] = useState({ name: '', industry: 'other', logoUrl: '', domain: '' });

  // New credential form
  const [credForm, setCredForm] = useState({ name: '', provider: '', value: '' });
  const [showCredForm, setShowCredForm] = useState(false);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    void apiRequest<OrgSettings>(`/orgs/${orgId}/settings`).then((o) => {
      setOrg(o);
      setOrgForm({ name: o.name, industry: o.industry, logoUrl: o.logoUrl ?? '', domain: o.domain ?? '' });
    }).catch(() => {});
    void apiRequest<Member[]>(`/orgs/${orgId}/settings/members`).then(setMembers).catch(() => {});
    void apiRequest<Credential[]>(`/orgs/${orgId}/settings/credentials`).then(setCredentials).catch(() => {});
  };

  useEffect(load, [orgId]);

  async function saveOrg() {
    if (!orgId) return;
    setSaving(true);
    try {
      const updated = await apiRequest<OrgSettings>(`/orgs/${orgId}/settings`, {
        method: 'PUT',
        body: JSON.stringify({
          name: orgForm.name || undefined,
          industry: orgForm.industry || undefined,
          logoUrl: orgForm.logoUrl || undefined,
          domain: orgForm.domain || undefined,
        }),
      });
      setOrg(updated);
      alert('Settings saved.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  async function changeRole(targetUserId: string, role: string) {
    if (!orgId) return;
    setActing(targetUserId);
    try {
      await apiRequest(`/orgs/${orgId}/settings/members/${targetUserId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setActing(null); }
  }

  async function removeMember(targetUserId: string) {
    if (!orgId || !confirm('Remove this member?')) return;
    setActing(targetUserId);
    try {
      await apiRequest(`/orgs/${orgId}/settings/members/${targetUserId}`, { method: 'DELETE' });
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setActing(null); }
  }

  async function addCredential() {
    if (!orgId || !credForm.name.trim() || !credForm.provider.trim() || !credForm.value.trim()) return;
    setSaving(true);
    try {
      await apiRequest(`/orgs/${orgId}/settings/credentials`, {
        method: 'POST',
        body: JSON.stringify(credForm),
      });
      setCredForm({ name: '', provider: '', value: '' });
      setShowCredForm(false);
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setSaving(false); }
  }

  async function deleteCredential(credId: string, name: string) {
    if (!orgId || !confirm(`Delete credential "${name}"?`)) return;
    setActing(credId);
    try {
      await apiRequest(`/orgs/${orgId}/settings/credentials/${credId}`, { method: 'DELETE' });
      load();
    } catch { alert('Failed to delete'); }
    finally { setActing(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your organization, members, and API credentials</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1 w-fit">
        {(['org', 'members', 'credentials'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t === 'org' ? 'Organization' : t === 'credentials' ? 'API Credentials' : 'Members'}
          </button>
        ))}
      </div>

      {/* Org tab */}
      {tab === 'org' && org && (
        <div className="max-w-lg space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${org.plan === 'enterprise' ? 'bg-amber-500/20 text-amber-400' : org.plan === 'growth' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-700 text-gray-300'}`}>
              {org.plan}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${org.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {org.status}
            </span>
            <span className="text-xs text-gray-500 font-mono">/{org.slug}</span>
          </div>

          <input placeholder="Organization name" value={orgForm.name}
            onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <select value={orgForm.industry} onChange={(e) => setOrgForm((f) => ({ ...f, industry: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {INDUSTRIES.map((i) => <option key={i} value={i} className="capitalize">{i.replace(/_/g, ' ')}</option>)}
          </select>

          <input placeholder="Logo URL" value={orgForm.logoUrl}
            onChange={(e) => setOrgForm((f) => ({ ...f, logoUrl: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <input placeholder="Custom domain (e.g. app.company.com)" value={orgForm.domain}
            onChange={(e) => setOrgForm((f) => ({ ...f, domain: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

          <button onClick={() => void saveOrg()} disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium text-white">{m.user.name}</p>
                <p className="text-xs text-gray-500">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLE[m.role] ?? 'bg-gray-700 text-gray-300'}`}>
                  {m.role}
                </span>
                {m.role !== 'owner' && (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => void changeRole(m.user.id, e.target.value)}
                      disabled={acting === m.user.id}
                      className="rounded border border-white/10 bg-gray-900 px-2 py-1 text-xs text-white focus:outline-none disabled:opacity-50"
                    >
                      {['admin', 'member', 'viewer'].map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button onClick={() => void removeMember(m.user.id)} disabled={acting === m.user.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credentials tab */}
      {tab === 'credentials' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCredForm(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              + Add Credential
            </button>
          </div>

          <div className="space-y-2">
            {credentials.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
                No API credentials stored yet.
              </div>
            )}
            {credentials.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{c.provider} · Added {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
                <button onClick={() => void deleteCredential(c.id, c.name)} disabled={acting === c.id}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
                  {acting === c.id ? '…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>

          {showCredForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Add API Credential</h2>
                <p className="text-xs text-gray-500">Values are encrypted with AES-256-GCM at rest and never returned via API.</p>

                <input placeholder="Name (e.g. Production Stripe Key)" value={credForm.name}
                  onChange={(e) => setCredForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

                <input placeholder="Provider (e.g. stripe, openai, twilio)" value={credForm.provider}
                  onChange={(e) => setCredForm((f) => ({ ...f, provider: e.target.value.toLowerCase() }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

                <input type="password" placeholder="API key or secret value" value={credForm.value}
                  onChange={(e) => setCredForm((f) => ({ ...f, value: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

                <div className="flex gap-3 pt-2">
                  <button onClick={() => void addCredential()}
                    disabled={saving || !credForm.name.trim() || !credForm.provider.trim() || !credForm.value.trim()}
                    className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Credential'}
                  </button>
                  <button onClick={() => setShowCredForm(false)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
