'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiRequest, getToken } from '@/lib/api';

interface Approval {
  id: string;
  requestedAction: string;
  reason: string;
  expectedOutcome: string;
  riskLevel: string;
  estimatedCostUsd: number | null;
  status: string;
  createdAt: string;
  agentRun: { agentId: string; taskType: string; input: unknown } | null;
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-400 bg-green-500/10',
  medium: 'text-yellow-400 bg-yellow-500/10',
  high: 'text-orange-400 bg-orange-500/10',
  critical: 'text-red-400 bg-red-500/10',
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [orgId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('nexusos_org') : null,
  );

  const fetchApprovals = useCallback(async () => {
    if (!orgId) return;
    const token = getToken();
    const data = await apiRequest<Approval[]>(`/orgs/${orgId}/approvals?status=pending`, {
      token: token ?? undefined,
    });
    setApprovals(data);
  }, [orgId]);

  useEffect(() => {
    setLoading(true);
    void fetchApprovals().finally(() => setLoading(false));
  }, [fetchApprovals]);

  const decide = async (approvalId: string, decision: 'approve' | 'reject', note?: string) => {
    if (!orgId) return;
    setActing(approvalId);
    try {
      const token = getToken();
      await apiRequest(`/orgs/${orgId}/approvals/${approvalId}/${decision}`, {
        method: 'POST',
        body: JSON.stringify({ note }),
        token: token ?? undefined,
      });
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    } catch (err) {
      console.error(err);
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold text-white">Approvals</h1>
      <p className="mb-8 text-slate-400">
        Review AI-requested actions before they are executed. All external sends and payments require approval.
      </p>

      {loading && <p className="text-slate-500">Loading...</p>}

      {!loading && approvals.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-10 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-medium text-white">No pending approvals</p>
          <p className="mt-1 text-sm text-slate-400">All AI-requested actions have been reviewed.</p>
        </div>
      )}

      <div className="space-y-4">
        {approvals.map((approval) => (
          <div key={approval.id} className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_COLORS[approval.riskLevel] ?? RISK_COLORS['medium']}`}>
                    {approval.riskLevel} risk
                  </span>
                  <code className="rounded bg-slate-800 px-2 py-0.5 text-xs text-violet-300">
                    {approval.requestedAction}
                  </code>
                </div>
                <p className="font-semibold text-white">{approval.reason}</p>
              </div>
              {approval.estimatedCostUsd && (
                <p className="text-sm font-medium text-slate-400 whitespace-nowrap">
                  ~${approval.estimatedCostUsd.toFixed(2)}
                </p>
              )}
            </div>

            <p className="mb-2 text-sm text-slate-400">
              <span className="font-medium text-slate-300">Expected outcome: </span>
              {approval.expectedOutcome}
            </p>

            {approval.agentRun && (
              <p className="mb-4 text-sm text-slate-500">
                Task: <span className="text-slate-400">{approval.agentRun.taskType}</span>
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => void decide(approval.id, 'approve')}
                disabled={acting === approval.id}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => void decide(approval.id, 'reject')}
                disabled={acting === approval.id}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
