'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type CrmTab = 'contacts' | 'companies' | 'deals' | 'activities';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  leadScore?: number;
  leadStatus?: string | null;
  source?: string | null;
  createdAt: string;
}

interface Company {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  createdAt: string;
}

interface Deal {
  id: string;
  name: string;
  value: number;
  currency: string;
  status: string;
  stage: { name: string; color: string };
  contact?: { firstName: string; lastName: string } | null;
  createdAt: string;
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  body?: string | null;
  createdAt: string;
}

function LeadScoreBadge({ score }: { score?: number }) {
  const s = score ?? 0;
  const color = s >= 70 ? 'bg-green-500/20 text-green-400' : s >= 40 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{s}</span>;
}

export default function CrmPage() {
  const [tab, setTab] = useState<CrmTab>('contacts');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [search, setSearch] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ firstName: '', lastName: '', email: '', phone: '', source: 'website' });
  const [submitting, setSubmitting] = useState(false);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  useEffect(() => {
    if (!orgId) return;
    void apiRequest<{ data: Contact[] }>(`/orgs/${orgId}/crm/contacts?search=${search}`).then((r) => setContacts(r.data)).catch(() => {});
    void apiRequest<{ data: Company[] }>(`/orgs/${orgId}/crm/companies`).then((r) => setCompanies(r.data)).catch(() => {});
    void apiRequest<Deal[]>(`/orgs/${orgId}/crm/deals`).then(setDeals).catch(() => {});
    void apiRequest<{ data: Activity[] }>(`/orgs/${orgId}/crm/activities?limit=30`).then((r) => setActivities(r.data)).catch(() => {});
  }, [orgId, search]);

  async function submitLead() {
    if (!orgId) return;
    setSubmitting(true);
    try {
      await apiRequest(`/orgs/${orgId}/crm/leads`, {
        method: 'POST',
        body: JSON.stringify(leadForm),
      });
      setShowLeadForm(false);
      setLeadForm({ firstName: '', lastName: '', email: '', phone: '', source: 'website' });
      const r = await apiRequest<{ data: Contact[] }>(`/orgs/${orgId}/crm/contacts`);
      setContacts(r.data);
    } catch {
      alert('Failed to submit lead');
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshScore(contactId: string) {
    if (!orgId) return;
    const updated = await apiRequest<Contact>(`/orgs/${orgId}/crm/contacts/${contactId}/score`, { method: 'POST' });
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const tabs: CrmTab[] = ['contacts', 'companies', 'deals', 'activities'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">CRM</h1>
        <button
          onClick={() => setShowLeadForm(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + New Lead
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-white/5 p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Contacts */}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-white/10 text-gray-400">
                <tr>
                  {['Name', 'Email', 'Source', 'Score', 'Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-gray-400">{c.email}</td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{c.source ?? '—'}</td>
                    <td className="px-4 py-3"><LeadScoreBadge score={c.leadScore} /></td>
                    <td className="px-4 py-3 text-gray-400 capitalize">{c.leadStatus ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void refreshScore(c.id)}
                        className="text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        Score
                      </button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No contacts yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Companies */}
      {tab === 'companies' && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-white/10 text-gray-400">
              <tr>
                {['Name', 'Domain', 'Industry', 'Size', 'Created'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {companies.map((co) => (
                <tr key={co.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white font-medium">{co.name}</td>
                  <td className="px-4 py-3 text-gray-400">{co.domain ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{co.industry ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{co.size ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(co.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No companies yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Deals */}
      {tab === 'deals' && (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm text-left">
            <thead className="border-b border-white/10 text-gray-400">
              <tr>
                {['Deal', 'Contact', 'Stage', 'Value', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-white">{d.name}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: d.stage.color + '33', color: d.stage.color }}
                    >
                      {d.stage.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {d.value > 0 ? `${d.currency} ${d.value.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{d.status}</td>
                </tr>
              ))}
              {deals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No deals yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Activities */}
      {tab === 'activities' && (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{a.subject}</span>
                <span className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
              <span className="mt-1 inline-block rounded bg-white/5 px-2 py-0.5 text-xs text-gray-400 capitalize">
                {a.type.replace(/_/g, ' ')}
              </span>
              {a.body && <p className="mt-1 text-sm text-gray-400">{a.body}</p>}
            </div>
          ))}
          {activities.length === 0 && (
            <p className="py-8 text-center text-gray-500">No activities yet</p>
          )}
        </div>
      )}

      {/* Lead form modal */}
      {showLeadForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6">
            <h2 className="text-lg font-semibold text-white">New Lead</h2>
            <div className="mt-4 space-y-3">
              {[
                { key: 'firstName', label: 'First Name', type: 'text' },
                { key: 'lastName', label: 'Last Name', type: 'text' },
                { key: 'email', label: 'Email', type: 'email' },
                { key: 'phone', label: 'Phone', type: 'tel' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-sm text-gray-400">{label}</label>
                  <input
                    type={type}
                    value={(leadForm as Record<string, string>)[key]}
                    onChange={(e) => setLeadForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-gray-400">Source</label>
                <select
                  value={leadForm.source}
                  onChange={(e) => setLeadForm((f) => ({ ...f, source: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {['website', 'referral', 'inbound', 'outbound', 'event', 'manual'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowLeadForm(false)}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitLead()}
                disabled={submitting}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Submit Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
