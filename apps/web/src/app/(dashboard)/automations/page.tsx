'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { executions: number };
  executions: Array<{ status: string; createdAt: string }>;
}

interface WorkflowExecution {
  id: string;
  status: string;
  createdAt: string;
  output: Record<string, unknown> | null;
}

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-500/20 text-green-400',
  running: 'bg-blue-500/20 text-blue-400',
  failed: 'bg-red-500/20 text-red-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
};

export default function AutomationsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    void apiRequest<Workflow[]>(`/orgs/${orgId}/automations`).then(setWorkflows).catch(() => {});
  };

  useEffect(load, [orgId]);

  useEffect(() => {
    if (!orgId || !selected) return;
    void apiRequest<WorkflowExecution[]>(`/orgs/${orgId}/automations/${selected}/executions`)
      .then(setExecutions).catch(() => {});
  }, [orgId, selected]);

  async function create() {
    if (!orgId || !form.name.trim()) return;
    setActing('create');
    try {
      await apiRequest(`/orgs/${orgId}/automations`, {
        method: 'POST',
        body: JSON.stringify({ name: form.name, description: form.description || undefined }),
      });
      setForm({ name: '', description: '' });
      setShowCreate(false);
      load();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed'); }
    finally { setActing(null); }
  }

  async function toggle(workflowId: string) {
    if (!orgId) return;
    setActing(workflowId);
    try {
      await apiRequest(`/orgs/${orgId}/automations/${workflowId}/toggle`, { method: 'PATCH', body: '{}' });
      load();
    } catch { alert('Failed to toggle'); }
    finally { setActing(null); }
  }

  async function trigger(workflowId: string) {
    if (!orgId) return;
    setActing(`trigger-${workflowId}`);
    try {
      await apiRequest(`/orgs/${orgId}/automations/${workflowId}/trigger`, { method: 'POST', body: '{}' });
      load();
      if (selected === workflowId) {
        void apiRequest<WorkflowExecution[]>(`/orgs/${orgId}/automations/${workflowId}/executions`)
          .then(setExecutions).catch(() => {});
      }
      alert('Workflow triggered successfully.');
    } catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to trigger'); }
    finally { setActing(null); }
  }

  async function deleteWorkflow(workflowId: string, name: string) {
    if (!orgId || !confirm(`Delete workflow "${name}"?`)) return;
    setActing(workflowId);
    try {
      await apiRequest(`/orgs/${orgId}/automations/${workflowId}`, { method: 'DELETE' });
      if (selected === workflowId) setSelected(null);
      load();
    } catch { alert('Failed to delete'); }
    finally { setActing(null); }
  }

  const selectedWorkflow = workflows.find((w) => w.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Automations</h1>
          <p className="mt-1 text-sm text-gray-400">Build and manage automated workflows powered by n8n</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + New Workflow
        </button>
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center text-gray-500">
          No workflows yet. Create one to start automating.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Workflow list */}
          <div className="lg:col-span-1 space-y-2">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setSelected(wf.id === selected ? null : wf.id)}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${selected === wf.id ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${wf.isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
                      <p className="font-medium text-white text-sm truncate">{wf.name}</p>
                    </div>
                    {wf.description && (
                      <p className="mt-1 text-xs text-gray-500 truncate">{wf.description}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-600">
                      {wf._count.executions} runs ·{' '}
                      {wf.executions[0] ? (
                        <span className={`${STATUS_STYLE[wf.executions[0].status] ?? 'text-gray-500'} bg-transparent px-0 py-0`}>
                          last: {wf.executions[0].status}
                        </span>
                      ) : 'never run'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selectedWorkflow ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
                Select a workflow to view details
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedWorkflow.name}</h2>
                    {selectedWorkflow.description && (
                      <p className="text-sm text-gray-400 mt-0.5">{selectedWorkflow.description}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      Created {new Date(selectedWorkflow.createdAt).toLocaleDateString()} · {selectedWorkflow._count.executions} total runs
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => void trigger(selectedWorkflow.id)}
                      disabled={!!acting}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {acting === `trigger-${selectedWorkflow.id}` ? '…' : '▶ Run Now'}
                    </button>
                    <button
                      onClick={() => void toggle(selectedWorkflow.id)}
                      disabled={acting === selectedWorkflow.id}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${selectedWorkflow.isActive ? 'border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border border-green-500/30 text-green-400 hover:bg-green-500/10'}`}
                    >
                      {acting === selectedWorkflow.id ? '…' : selectedWorkflow.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => void deleteWorkflow(selectedWorkflow.id, selectedWorkflow.name)}
                      disabled={!!acting}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Execution history */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Recent Executions</h3>
                  {executions.length === 0 ? (
                    <p className="text-sm text-gray-500">No executions yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {executions.map((ex) => (
                        <div key={ex.id} className="flex items-center gap-3 text-xs rounded-lg bg-white/5 px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[ex.status] ?? 'bg-gray-700 text-gray-300'}`}>
                            {ex.status}
                          </span>
                          <span className="text-gray-500 font-mono">{new Date(ex.createdAt).toLocaleString()}</span>
                          <span className="text-gray-700 font-mono">{ex.id.slice(0, 8)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">New Workflow</h2>
            <input placeholder="Workflow name" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <textarea placeholder="Description (optional)" value={form.description} rows={3}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <div className="flex gap-3 pt-2">
              <button onClick={() => void create()} disabled={acting === 'create' || !form.name.trim()}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {acting === 'create' ? 'Creating…' : 'Create Workflow'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
