'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface CalendarIntegration {
  id: string;
  provider: string;
  accountEmail: string;
  isActive: boolean;
}

interface CalendarSlot {
  start: string;
  end: string;
  available: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Calendar',
  outlook: 'Microsoft Outlook',
  caldav: 'CalDAV',
};

const PROVIDER_ICONS: Record<string, string> = {
  google: '🔴',
  outlook: '🔵',
  caldav: '📅',
};

export default function CalendarPage() {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0] ?? '');
  const [loadingSlots, setLoadingSlots] = useState(false);

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  useEffect(() => {
    if (!orgId) return;
    void apiRequest<CalendarIntegration[]>(`/orgs/${orgId}/calendar/integrations`).then(setIntegrations).catch(() => {});
  }, [orgId]);

  async function loadSlots() {
    if (!orgId || !selectedDate) return;
    setLoadingSlots(true);
    try {
      const data = await apiRequest<CalendarSlot[]>(
        `/orgs/${orgId}/calendar/slots?date=${selectedDate}&durationMinutes=30`,
      );
      setSlots(data);
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  }

  async function disconnect(provider: string) {
    if (!orgId) return;
    await apiRequest(`/orgs/${orgId}/calendar/integrations/${provider}`, { method: 'DELETE' });
    setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
  }

  const connectedProviders = new Set(integrations.map((i) => i.provider));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Calendar</h1>
        <p className="mt-1 text-sm text-gray-400">Connect your calendar so AI employees can book and check availability</p>
      </div>

      {/* Connected integrations */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Connected Calendars</h2>
        {integrations.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-gray-500">No calendars connected yet.</p>
            <p className="mt-1 text-xs text-gray-600">OAuth connection will be available in the next update.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{PROVIDER_ICONS[i.provider] ?? '📅'}</span>
                  <div>
                    <p className="font-medium text-white">{PROVIDER_LABELS[i.provider] ?? i.provider}</p>
                    <p className="text-sm text-gray-400">{i.accountEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">Connected</span>
                  <button
                    onClick={() => void disconnect(i.provider)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Connect new */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Add Calendar</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {['google', 'outlook', 'caldav'].map((p) => {
            const connected = connectedProviders.has(p);
            return (
              <div key={p} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{PROVIDER_ICONS[p]}</span>
                  <span className="font-medium text-white">{PROVIDER_LABELS[p]}</span>
                </div>
                <button
                  disabled={connected}
                  className={`mt-3 w-full rounded-lg py-2 text-sm font-medium transition-colors ${
                    connected
                      ? 'cursor-not-allowed bg-white/5 text-gray-500'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500'
                  }`}
                >
                  {connected ? 'Connected' : 'Connect (Phase 6)'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Availability checker */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Availability</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm text-gray-400">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => void loadSlots()}
            disabled={loadingSlots}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loadingSlots ? 'Loading…' : 'Check Availability'}
          </button>
        </div>

        {slots.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {slots.map((slot) => (
              <div
                key={slot.start}
                className={`rounded-lg border px-3 py-2 text-center text-sm ${
                  slot.available
                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                    : 'border-white/10 bg-white/5 text-gray-500'
                }`}
              >
                {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
