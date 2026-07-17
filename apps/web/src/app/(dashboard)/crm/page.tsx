'use client';

import { useEffect, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  leadStatus: string;
  leadScore: number;
  source: string | null;
  createdAt: string;
}

interface SubmitLeadResult {
  contactId: string;
  dealId: string | null;
  agentRunId: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300',
  contacted: 'bg-yellow-500/20 text-yellow-300',
  qualified: 'bg-green-500/20 text-green-300',
  unqualified: 'bg-red-500/20 text-red-300',
  converted: 'bg-violet-500/20 text-violet-300',
};

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '', phone: '', source: 'manual', agentId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<SubmitLeadResult | null>(null);
  const [orgId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('nexusos_org') : null,
  );

  useEffect(() => {
    if (!orgId) return;
    const token = getToken();
    void apiRequest<{ data: Contact[] }>(`/orgs/${orgId}/crm/contacts`, {
      token: token ?? undefined,
    }).then((r) => setContacts(r.data)).catch(console.error);

    void apiRequest<{ id: string; name: string }[]>(`/orgs/${orgId}/agents`, {
      token: token ?? undefined,
    }).then(setAgents).catch(console.error);
  }, [orgId]);

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    try {
      const token = getToken();
      const result = await apiRequest<SubmitLeadResult>(`/orgs/${orgId}/crm/leads`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          agentId: form.agentId || undefined,
        }),
        token: token ?? undefined,
      });
      setLastResult(result);
      setShowForm(false);
      setForm({ email: '', firstName: '', lastName: '', phone: '', source: 'manual', agentId: '' });
      // Refresh contacts
      const refreshed = await apiRequest<{ data: Contact[] }>(`/orgs/${orgId}/crm/contacts`, {
        token: token ?? undefined,
      });
      setContacts(refreshed.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM</h1>
          <p className="mt-1 text-slate-400">{contacts.length} contacts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          + Add Lead
        </button>
      </div>

      {lastResult && (
        <div className="mb-6 rounded-lg border border-green-800 bg-green-950/40 p-4 text-sm text-green-300">
          Lead created.{' '}
          {lastResult.agentRunId ? (
            <>AI qualification run started — check <a href="/approvals" className="underline">Approvals</a> when it requests actions.</>
          ) : (
            'Install an AI employee to auto-qualify this lead.'
          )}
        </div>
      )}

      {showForm && (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 font-semibold text-white">New Lead</h2>
          <form onSubmit={(e) => void submitLead(e)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">First name *</label>
              <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Last name *</label>
              <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Email *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">Auto-qualify with AI employee (optional)</label>
              <select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none">
                <option value="">— No auto-qualification —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <button type="submit" disabled={submitting}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit lead'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-4 py-3 font-medium text-slate-400">Name</th>
              <th className="px-4 py-3 font-medium text-slate-400">Email</th>
              <th className="px-4 py-3 font-medium text-slate-400">Status</th>
              <th className="px-4 py-3 font-medium text-slate-400">Score</th>
              <th className="px-4 py-3 font-medium text-slate-400">Source</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  No contacts yet. Add your first lead above.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-4 py-3 font-medium text-white">
                  {c.firstName} {c.lastName}
                </td>
                <td className="px-4 py-3 text-slate-400">{c.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.leadStatus] ?? 'bg-slate-700 text-slate-300'}`}>
                    {c.leadStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{c.leadScore}</td>
                <td className="px-4 py-3 text-slate-500">{c.source ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
