'use client';

import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  approval_requested: '✅',
  approval_decided: '📋',
  agent_run_completed: '🤖',
  agent_run_failed: '⚠️',
  email_draft_ready: '✉️',
  email_sent: '📨',
  lead_enriched: '👤',
  deal_stage_changed: '📈',
  system: 'ℹ️',
};

export function NotificationsBell({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orgId) return;
    const load = () => {
      void apiRequest<{ data: Notification[]; unreadCount: number }>(
        `/orgs/${orgId}/notifications?limit=10`,
      ).then((r) => {
        setNotifications(r.data);
        setUnread(r.unreadCount);
      }).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [orgId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function markRead(id: string) {
    await apiRequest(`/orgs/${orgId}/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await apiRequest(`/orgs/${orgId}/notifications/read-all`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-white/10 bg-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.read) void markRead(n.id); }}
                  className={`flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${
                    n.read ? 'opacity-60' : ''
                  }`}
                >
                  <span className="mt-0.5 text-base">
                    {TYPE_ICON[n.type] ?? 'ℹ️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{n.body}</p>}
                    <p className="mt-1 text-xs text-gray-600">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
