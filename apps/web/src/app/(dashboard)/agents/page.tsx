'use client';

import { useEffect, useState } from 'react';
import { apiRequest, getToken } from '@/lib/api';

interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  department: string;
  capabilities: string[];
  requiredPlan: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  department: string;
  status: string;
  modelName: string;
  createdAt: string;
}

const DEPT_COLORS: Record<string, string> = {
  sales: 'bg-blue-500/20 text-blue-300',
  support: 'bg-green-500/20 text-green-300',
  executive: 'bg-violet-500/20 text-violet-300',
  marketing: 'bg-pink-500/20 text-pink-300',
  operations: 'bg-orange-500/20 text-orange-300',
  finance: 'bg-yellow-500/20 text-yellow-300',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [orgId] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('nexusos_org') : null,
  );

  useEffect(() => {
    if (!orgId) return;
    const token = getToken();
    void apiRequest<{ id: string; name: string; role: string; department: string; status: string; modelName: string; createdAt: string }[]>(
      `/orgs/${orgId}/agents`,
      { token: token ?? undefined },
    ).then(setAgents).catch(console.error);

    void apiRequest<AgentTemplate[]>(`/orgs/${orgId}/agents/templates`, {
      token: token ?? undefined,
    }).then(setTemplates).catch(console.error);
  }, [orgId]);

  const install = async (templateId: string) => {
    if (!orgId) return;
    setInstalling(templateId);
    try {
      const token = getToken();
      const agent = await apiRequest<Agent>(`/orgs/${orgId}/agents/install`, {
        method: 'POST',
        body: JSON.stringify({ templateId }),
        token: token ?? undefined,
      });
      setAgents((prev) => [...prev, agent]);
    } catch (err) {
      console.error(err);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="mb-2 text-2xl font-bold text-white">AI Employees</h1>
      <p className="mb-8 text-slate-400">Install AI employees to automate sales, support, and operations.</p>

      {agents.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-white">Installed</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <div key={agent.id} className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-violet-600 flex items-center justify-center font-bold text-white">
                    {agent.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{agent.name}</p>
                    <p className="text-xs text-slate-400">{agent.role}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DEPT_COLORS[agent.department] ?? 'bg-slate-700 text-slate-300'}`}>
                    {agent.department}
                  </span>
                  <span className={`text-xs font-medium ${agent.status === 'active' ? 'text-green-400' : 'text-slate-500'}`}>
                    {agent.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{agent.modelName}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Available Templates</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => {
            const alreadyInstalled = agents.some((a) => a.role === tpl.role);
            return (
              <div key={tpl.id} className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                <p className="mb-1 font-semibold text-white">{tpl.name}</p>
                <p className="mb-3 text-sm text-slate-400">{tpl.description}</p>
                <div className="mb-4 flex flex-wrap gap-1">
                  {tpl.capabilities.slice(0, 3).map((c) => (
                    <span key={c} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      {c.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => void install(tpl.id)}
                  disabled={alreadyInstalled || installing === tpl.id || !orgId}
                  className="w-full rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
                >
                  {alreadyInstalled ? 'Installed' : installing === tpl.id ? 'Installing...' : 'Install'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
