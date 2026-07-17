import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-4xl px-6 py-20 text-center">
        <div className="mb-6 inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-4 py-1.5 text-sm text-slate-300">
          Now in Early Access
        </div>
        <h1 className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-6xl">
          Your Business, Powered by{' '}
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            AI Employees
          </span>
        </h1>
        <p className="mb-10 text-xl text-slate-400">
          NexusOS gives your company an AI operating system — with AI employees, CRM, sales automation,
          marketing, and workflow automation in one platform.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-8 py-3 text-base font-medium text-white hover:bg-violet-700"
          >
            Start Free Trial
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-8 py-3 text-base font-medium text-slate-300 hover:bg-slate-800"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-6 text-left sm:grid-cols-3">
          {[
            { icon: '🤖', title: 'AI Employees', desc: 'Sales, support, marketing, ops — all built in' },
            { icon: '📊', title: 'CRM & Pipeline', desc: 'Contacts, deals, and activities in one place' },
            { icon: '⚡', title: 'Automation', desc: 'n8n-powered workflows without code' },
            { icon: '✅', title: 'Human Approvals', desc: 'Review every AI action before it happens' },
            { icon: '🔌', title: '200+ Integrations', desc: 'Connect your existing tools via RapidAPI' },
            { icon: '📈', title: 'Business Analytics', desc: 'Revenue, pipeline, and AI cost tracking' },
          ].map((feature) => (
            <div key={feature.title} className="rounded-lg border border-slate-700 bg-slate-800/50 p-5">
              <div className="mb-3 text-2xl">{feature.icon}</div>
              <h3 className="mb-1 font-semibold text-white">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
