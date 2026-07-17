'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

interface AuditEvent {
  id: string;
  orgId: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  payload: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

const ACTOR_TYPE_STYLE: Record<string, string> = {
  user: 'bg-blue-500/20 text-blue-400',
  agent: 'bg-violet-500/20 text-violet-400',
  system: 'bg-gray-700 text-gray-400',
  webhook: 'bg-amber-500/20 text-amber-400',
};

const ACTION_PREFIXES: Record<string, string> = {
  'agent.': 'bg-violet-500/10 text-violet-300',
  'billing.': 'bg-green-500/10 text-green-300',
  'org.': 'bg-blue-500/10 text-blue-300',
  'auth.': 'bg-amber-500/10 text-amber-300',
  'plugin.': 'bg-pink-500/10 text-pink-300',
};

function actionStyle(action: string): string {
  for (const [prefix, style] of Object.entries(ACTION_PREFIXES)) {
    if (action.startsWith(prefix)) return style;
  }
  return 'bg-gray-700 text-gray-300';
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = useCallback(
    async (reset = false) => {
      if (!orgId || loading) return;
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (action.trim()) params.set('action', action.trim());
        if (resourceType.trim()) params.set('resourceType', resourceType.trim());
        if (!reset && cursor) params.set('cursor', cursor);

        const data = await apiRequest<AuditEvent[]>(
          `/orgs/${orgId}/audit?${params.toString()}`,
        );
        if (reset) {
          setEvents(data);
        } else {
          setEvents((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === 50);
        if (data.length > 0) {
          setCursor(data[data.length - 1].createdAt);
        }
      } catch {
        // Admin access required — silently show empty
      } finally {
        setLoading(false);
      }
    },
    [orgId, action, resourceType, cursor, loading],
  );

  useEffect(() => {
    setCursor(undefined);
    setEvents([]);
    setHasMore(true);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, action, resourceType]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-400">
          Immutable record of all actions across your organization
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          placeholder="Filter by action (e.g. agent.run.started)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          placeholder="Filter by resource type (e.g. Agent)"
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Event list */}
      <div className="space-y-1">
        {events.length === 0 && !loading && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">
            No audit events found.{action || resourceType ? ' Try clearing the filters.' : ''}
          </div>
        )}

        {events.map((ev) => (
          <div key={ev.id} className="rounded-lg border border-white/10 bg-white/5">
            <button
              className="w-full text-left px-4 py-3"
              onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-500 font-mono w-36 shrink-0">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionStyle(ev.action)}`}
                >
                  {ev.action}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${ACTOR_TYPE_STYLE[ev.actorType] ?? 'bg-gray-700 text-gray-400'}`}
                >
                  {ev.actorType}
                </span>
                {ev.resourceType && (
                  <span className="text-xs text-gray-400">
                    {ev.resourceType}
                    {ev.resourceId ? `:${ev.resourceId.slice(0, 8)}` : ''}
                  </span>
                )}
                {ev.actorId && (
                  <span className="ml-auto text-xs text-gray-600 font-mono">
                    actor:{ev.actorId.slice(0, 8)}
                  </span>
                )}
              </div>
            </button>

            {expanded === ev.id && (
              <div className="border-t border-white/5 px-4 py-3 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {ev.ipAddress && (
                    <div>
                      <p className="text-gray-500">IP</p>
                      <p className="text-gray-300 font-mono">{ev.ipAddress}</p>
                    </div>
                  )}
                  {ev.requestId && (
                    <div>
                      <p className="text-gray-500">Request ID</p>
                      <p className="text-gray-300 font-mono">{ev.requestId}</p>
                    </div>
                  )}
                  {ev.actorId && (
                    <div>
                      <p className="text-gray-500">Actor ID</p>
                      <p className="text-gray-300 font-mono">{ev.actorId}</p>
                    </div>
                  )}
                </div>
                {Object.keys(ev.payload).length > 0 && (
                  <div>
                    <p className="text-gray-500 mb-1">Payload</p>
                    <pre className="rounded bg-black/30 p-2 text-xs text-gray-400 overflow-x-auto">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="py-6 text-center text-sm text-gray-500">Loading…</div>
        )}

        {hasMore && !loading && events.length > 0 && (
          <button
            onClick={() => void load()}
            className="mt-2 w-full rounded-lg border border-white/10 py-2 text-sm text-gray-400 hover:text-white"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}
