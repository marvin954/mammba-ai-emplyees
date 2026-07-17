'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: '⊞' },
  { href: '/agents', label: 'AI Employees', icon: '🤖' },
  { href: '/approvals', label: 'Approvals', icon: '✅' },
  { href: '/crm', label: 'CRM', icon: '👥' },
  { href: '/email-drafts', label: 'Email Drafts', icon: '✉️' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/knowledge', label: 'Knowledge', icon: '🧠' },
  { href: '/marketing', label: 'Marketing', icon: '📣' },
  { href: '/support', label: 'Support', icon: '💬' },
  { href: '/finance', label: 'Finance', icon: '💵' },
  { href: '/marketplace', label: 'Marketplace', icon: '🏪' },
  { href: '/agency', label: 'Agency', icon: '🏢' },
  { href: '/automations', label: 'Automations', icon: '⚡' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/billing', label: 'Billing', icon: '💳' },
  { href: '/audit', label: 'Audit Log', icon: '🔍' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-800 bg-slate-900">
      <div className="flex h-16 items-center border-b border-slate-800 px-6">
        <span className="text-lg font-bold text-white">NexusOS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Your Org</p>
            <p className="text-xs text-slate-500">Starter Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
