'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface Ticket {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  fromEmail?: string | null;
  fromName?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  _count: { messages: number };
}

interface TicketMessage {
  id: string;
  senderType: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  avgResolutionHours: number;
}

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  waiting: 'bg-purple-500/20 text-purple-400',
  resolved: 'bg-green-500/20 text-green-400',
  closed: 'bg-gray-700 text-gray-500',
};

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-gray-700 text-gray-400',
};

const SENDER_STYLE: Record<string, string> = {
  customer: 'text-blue-300',
  agent: 'text-white',
  ai: 'text-violet-400',
};

export default function SupportPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'medium', fromEmail: '', fromName: '' });

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    const q = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    void apiRequest<{ data: Ticket[] }>(`/orgs/${orgId}/support/tickets${q}`)
      .then((r) => setTickets(r.data)).catch(() => {});
    void apiRequest<Summary>(`/orgs/${orgId}/support/summary`).then(setSummary).catch(() => {});
  };

  useEffect(load, [orgId, statusFilter]);

  async function openTicket(id: string) {
    if (!orgId) return;
    const t = await apiRequest<TicketDetail>(`/orgs/${orgId}/support/tickets/${id}`);
    setSelected(t);
    setReply('');
  }

  async function sendReply() {
    if (!orgId || !selected || !reply.trim()) return;
    setReplying(true);
    try {
      await apiRequest(`/orgs/${orgId}/support/tickets/${selected.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: reply, senderType: 'agent' }),
      });
      setReply('');
      await openTicket(selected.id);
    } catch { alert('Failed to send reply'); }
    finally { setReplying(false); }
  }

  async function updateStatus(ticketId: string, status: string) {
    if (!orgId) return;
    await apiRequest(`/orgs/${orgId}/support/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    load();
    if (selected?.id === ticketId) setSelected(null);
  }

  async function createTicket() {
    if (!orgId || !newTicket.subject.trim() || !newTicket.description.trim()) return;
    setCreating(true);
    try {
      await apiRequest(`/orgs/${orgId}/support/tickets`, {
        method: 'POST',
        body: JSON.stringify(newTicket),
      });
      setNewTicket({ subject: '', description: '', priority: 'medium', fromEmail: '', fromName: '' });
      setShowCreate(false);
      load();
    } catch { alert('Failed to create ticket'); }
    finally { setCreating(false); }
  }

  const statuses = ['all', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Support</h1>
          <p className="mt-1 text-sm text-gray-400">Customer support tickets and AI-assisted responses</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + New Ticket
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Total Tickets</p>
            <p className="mt-1 text-2xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Open</p>
            <p className="mt-1 text-2xl font-bold text-blue-400">{(summary.byStatus['open'] ?? 0) + (summary.byStatus['in_progress'] ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Urgent</p>
            <p className="mt-1 text-2xl font-bold text-red-400">{summary.byPriority['urgent'] ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Avg Resolution</p>
            <p className="mt-1 text-2xl font-bold text-white">{summary.avgResolutionHours}h</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {tickets.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
            No tickets{statusFilter !== 'all' ? ` with status "${statusFilter.replace(/_/g, ' ')}"` : ''}.
          </div>
        )}
        {tickets.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => void openTicket(t.id)}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">#{t.ticketNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[t.status] ?? 'bg-gray-700 text-gray-300'}`}>{t.status.replace(/_/g, ' ')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[t.priority] ?? 'bg-gray-700 text-gray-300'}`}>{t.priority}</span>
                </div>
                <h3 className="mt-2 font-semibold text-white">{t.subject}</h3>
                {t.fromName && <p className="text-sm text-gray-400">From: {t.fromName}{t.fromEmail && ` <${t.fromEmail}>`}</p>}
                <p className="mt-1 text-xs text-gray-500">{t._count.messages} messages · {new Date(t.createdAt).toLocaleDateString()}</p>
              </div>
              {['open', 'in_progress', 'waiting'].includes(t.status) && (
                <button
                  onClick={(e) => { e.stopPropagation(); void updateStatus(t.id, 'resolved'); }}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-500 shrink-0"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ticket detail */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900 flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between p-6 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500">#{selected.ticketNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[selected.status] ?? 'bg-gray-700 text-gray-300'}`}>{selected.status.replace(/_/g, ' ')}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLE[selected.priority] ?? ''}`}>{selected.priority}</span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white">{selected.subject}</h2>
                {selected.fromName && <p className="text-sm text-gray-400">From: {selected.fromName}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {selected.messages.map((m) => (
                <div key={m.id} className={`rounded-lg p-3 ${m.isInternal ? 'border border-yellow-500/20 bg-yellow-500/5' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium capitalize ${SENDER_STYLE[m.senderType] ?? 'text-gray-300'}`}>{m.senderType}{m.isInternal && ' (internal)'}</span>
                    <span className="text-xs text-gray-600">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-white/10 space-y-3">
              <textarea
                placeholder="Write a reply…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-3">
                <button onClick={() => void sendReply()} disabled={replying || !reply.trim()}
                  className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                  {replying ? 'Sending…' : 'Send Reply'}
                </button>
                {['open', 'in_progress'].includes(selected.status) && (
                  <button onClick={() => void updateStatus(selected.id, 'resolved')}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-500">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">New Ticket</h2>
            <input placeholder="Subject" value={newTicket.subject} onChange={(e) => setNewTicket((t) => ({ ...t, subject: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <textarea placeholder="Description" value={newTicket.description} onChange={(e) => setNewTicket((t) => ({ ...t, description: e.target.value }))} rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={newTicket.priority} onChange={(e) => setNewTicket((t) => ({ ...t, priority: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <input placeholder="From email (optional)" value={newTicket.fromEmail} onChange={(e) => setNewTicket((t) => ({ ...t, fromEmail: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex gap-3 pt-2">
              <button onClick={() => void createTicket()} disabled={creating || !newTicket.subject.trim() || !newTicket.description.trim()}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Ticket'}
              </button>
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
