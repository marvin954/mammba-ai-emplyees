export default function DashboardPage() {
  const stats = [
    { label: 'Pipeline Value', value: '$0', change: '', icon: '💰' },
    { label: 'New Leads', value: '0', change: '', icon: '👤' },
    { label: 'Open Deals', value: '0', change: '', icon: '🤝' },
    { label: 'Approvals Waiting', value: '0', change: '', icon: '⏳' },
    { label: 'AI Runs Today', value: '0', change: '', icon: '🤖' },
    { label: 'AI Cost (Month)', value: '$0.00', change: '', icon: '💳' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Good morning</h1>
        <p className="mt-1 text-slate-400">Here&apos;s what&apos;s happening in your business today.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-800 bg-slate-900 p-5"
          >
            <div className="mb-3 text-2xl">{stat.icon}</div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 font-semibold text-white">Recent AI Activity</h2>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">No AI activity yet. Install an AI employee to get started.</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 font-semibold text-white">Pending Approvals</h2>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">No approvals waiting.</p>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-violet-800/50 bg-violet-950/30 p-6">
        <h2 className="mb-2 font-semibold text-violet-300">Get started with NexusOS</h2>
        <p className="mb-4 text-sm text-slate-400">
          Complete these steps to activate your AI operating system.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { step: '1', label: 'Install an AI Employee', href: '/agents' },
            { step: '2', label: 'Add your first lead', href: '/crm' },
            { step: '3', label: 'Connect an integration', href: '/settings/integrations' },
            { step: '4', label: 'Set up a workflow', href: '/automations' },
          ].map((item) => (
            <a
              key={item.step}
              href={item.href}
              className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 p-4 hover:border-violet-600 hover:bg-slate-800"
            >
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                {item.step}
              </div>
              <span className="text-sm font-medium text-white">{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
