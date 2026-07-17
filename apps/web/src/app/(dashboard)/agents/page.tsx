'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  department: string;
  capabilities: readonly string[];
  requiredPlan: string;
}

interface InstalledAgent {
  id: string;
  templateId?: string;
  name: string;
  role: string;
  department: string;
  status: string;
  modelName: string;
  createdAt: string;
}

const DEPT_COLORS: Record<string, string> = {
  sales: 'bg-blue-500/20 text-blue-300',
  executive: 'bg-purple-500/20 text-purple-300',
  support: 'bg-green-500/20 text-green-300',
  marketing: 'bg-pink-500/20 text-pink-300',
  operations: 'bg-orange-500/20 text-orange-300',
  finance: 'bg-yellow-500/20 text-yellow-300',
  hr: 'bg-teal-500/20 text-teal-300',
  analytics: 'bg-cyan-500/20 text-cyan-300',
};

const PLAN_BADGE: Record<string, string> = {
  starter: 'bg-gray-700 text-gray-300',
  growth: 'bg-indigo-500/20 text-indigo-300',
  enterprise: 'bg-amber-500/20 text-amber-300',
};

export default function AgentsPage() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [installed, setInstalled] = useState<InstalledAgent[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  useEffect(() => {
    if (!orgId) return;
    void apiRequest<AgentTemplate[]>(`/orgs/${orgId}/agents/templates`).then(setTemplates).catch(() => {});
    void apiRequest<InstalledAgent[]>(`/orgs/${orgId}/agents`).then(setInstalled).catch(() => {});
  }, [orgId]);

  async function install(templateId: string) {
    if (!orgId) return;
    setInstalling(templateId);
    try {
      const agent = await apiRequest<InstalledAgent>(`/orgs/${orgId}/agents/install`, {
        method: 'POST',
        body: JSON.stringify({ templateId }),
      });
      setInstalled((prev) => [...prev, agent]);
      setActiveTab('installed');
    } catch {
      alert('Failed to install agent');
    } finally {
      setInstalling(null);
    }
  }

  const installedTemplateIds = new Set(installed.map((a) => a.templateId ?? ''));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Employees</h1>
          <p className="mt-1 text-sm text-gray-400">
            {installed.length} installed &middot; {templates.length} available
          </p>
        </div>
        <div className="flex gap-2 rounded-lg bg-white/5 p-1">
          {(['installed', 'marketplace'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'installed' ? `Installed (${installed.length})` : 'Marketplace'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'installed' ? (
        installed.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-gray-400">No agents installed yet.</p>
            <button
              onClick={() => setActiveTab('marketplace')}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {installed.map((agent) => (
              <div key={agent.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DEPT_COLORS[agent.department] ?? 'bg-gray-700 text-gray-300'}`}
                    >
                      {agent.department}
                    </span>
                    <h3 className="mt-2 font-semibold text-white">{agent.name}</h3>
                    <p className="text-sm text-gray-400">{agent.role}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${agent.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}
                  >
                    {agent.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-gray-500">Model: {agent.modelName}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => {
            const isInstalled = installedTemplateIds.has(tpl.id);
            return (
              <div key={tpl.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DEPT_COLORS[tpl.department] ?? 'bg-gray-700 text-gray-300'}`}
                  >
                    {tpl.department}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_BADGE[tpl.requiredPlan] ?? 'bg-gray-700 text-gray-300'}`}
                  >
                    {tpl.requiredPlan}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold text-white">{tpl.name}</h3>
                <p className="mt-1 text-sm text-gray-400">{tpl.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {tpl.capabilities.map((cap) => (
                    <span key={cap} className="rounded bg-white/5 px-2 py-0.5 text-xs text-gray-400">
                      {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => void install(tpl.id)}
                  disabled={isInstalled || installing === tpl.id}
                  className={`mt-4 w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                    isInstalled
                      ? 'cursor-not-allowed bg-white/5 text-gray-500'
                      : installing === tpl.id
                        ? 'cursor-wait bg-indigo-700 text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  }`}
                >
                  {isInstalled ? 'Installed' : installing === tpl.id ? 'Installing…' : 'Install'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
