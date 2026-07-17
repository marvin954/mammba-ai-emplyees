'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface EmailDraft {
  id: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  status: string;
  agentRunId?: string | null;
  createdAt: string;
  sentAt?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-700 text-gray-300',
  pending_approval: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-blue-500/20 text-blue-400',
  sent: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

export default function EmailDraftsPage() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [filter, setFilter] = useState('all');
  const [acting, setActing] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmailDraft | null>(null);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    void apiRequest<{ data: EmailDraft[] }>(
      `/orgs/${orgId}/email-drafts${filter !== 'all' ? `?status=${filter}` : ''}`,
    ).then((r) => setDrafts(r.data)).catch(() => {});
  };

  useEffect(load, [orgId, filter]);

  async function approve(draftId: string) {
    if (!orgId) return;
    setActing(draftId);
    try {
      await apiRequest(`/orgs/${orgId}/email-drafts/${draftId}/approve`, { method: 'POST' });
      load();
    } catch { alert('Failed to approve draft'); }
    finally { setActing(null); }
  }

  async function reject(draftId: string) {
    if (!orgId) return;
    const reason = window.prompt('Reason for rejection (optional):') ?? '';
    setActing(draftId);
    try {
      await apiRequest(`/orgs/${orgId}/email-drafts/${draftId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      load();
    } catch { alert('Failed to reject draft'); }
    finally { setActing(null); }
  }

  const filters = ['all', 'draft', 'pending_approval', 'approved', 'sent', 'rejected'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Drafts</h1>
          <p className="mt-1 text-sm text-gray-400">Review and approve AI-drafted emails before they send</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Draft list */}
      <div className="space-y-3">
        {drafts.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
            No email drafts{filter !== 'all' ? ` with status "${filter.replace(/_/g, ' ')}"` : ''}.
          </div>
        )}

        {drafts.map((draft) => (
          <div key={draft.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[draft.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {draft.status.replace(/_/g, ' ')}
                  </span>
                  {draft.agentRunId && (
                    <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs text-violet-400">AI-drafted</span>
                  )}
                </div>
                <h3 className="mt-2 font-semibold text-white">{draft.subject}</h3>
                <p className="mt-0.5 text-sm text-gray-400">To: {draft.toAddress}</p>
                <p className="mt-2 text-sm text-gray-400 line-clamp-2">{draft.bodyText}</p>
                <p className="mt-2 text-xs text-gray-600">
                  Created {new Date(draft.createdAt).toLocaleString()}
                  {draft.sentAt && ` · Sent ${new Date(draft.sentAt).toLocaleString()}`}
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => setPreview(draft)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                >
                  Preview
                </button>
                {['draft', 'pending_approval'].includes(draft.status) && (
                  <>
                    <button
                      onClick={() => void approve(draft.id)}
                      disabled={acting === draft.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      Approve & Send
                    </button>
                    <button
                      onClick={() => void reject(draft.id)}
                      disabled={acting === draft.id}
                      className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900 p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{preview.subject}</h2>
                <p className="text-sm text-gray-400">To: {preview.toAddress}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="rounded-lg bg-white/5 p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{preview.bodyText}</p>
            </div>
            <div className="mt-4 flex gap-3">
              {['draft', 'pending_approval'].includes(preview.status) && (
                <>
                  <button
                    onClick={() => { void approve(preview.id); setPreview(null); }}
                    className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-500"
                  >
                    Approve & Send
                  </button>
                  <button
                    onClick={() => { void reject(preview.id); setPreview(null); }}
                    className="flex-1 rounded-lg bg-red-600/80 py-2 text-sm font-medium text-white hover:bg-red-600"
                  >
                    Reject
                  </button>
                </>
              )}
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
