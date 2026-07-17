'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { NotificationsBell } from '@/components/notifications/notifications-bell';
import { useEffect, useState } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [orgId, setOrgId] = useState('');

  useEffect(() => {
    setOrgId(localStorage.getItem('orgId') ?? '');
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center justify-end border-b border-white/5 bg-slate-950 px-6">
          {orgId && <NotificationsBell orgId={orgId} />}
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
