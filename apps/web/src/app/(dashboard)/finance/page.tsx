'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

interface Transaction {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  vendor?: string | null;
  reference?: string | null;
  flagged: boolean;
  flagReason?: string | null;
  reconciled: boolean;
  createdAt: string;
}

interface Summary {
  period: { start: string; end: string };
  income: number;
  expenses: number;
  net: number;
  flaggedCount: number;
  unreconciledCount: number;
  topExpenseCategories: { category: string; total: number; count: number }[];
}

const TYPE_STYLE: Record<string, string> = {
  income: 'text-green-400',
  expense: 'text-red-400',
  transfer: 'text-blue-400',
};

const EXPENSE_CATEGORIES = [
  'uncategorized', 'payroll', 'software', 'marketing', 'travel',
  'office', 'legal', 'consulting', 'hardware', 'utilities', 'other',
];

export default function FinancePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [unreconciledOnly, setUnreconciledOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    type: 'expense', category: 'uncategorized', description: '',
    amount: '', currency: 'USD', date: new Date().toISOString().split('T')[0] ?? '',
    vendor: '', reference: '',
  });

  const orgId = typeof window !== 'undefined' ? localStorage.getItem('orgId') : null;

  const load = () => {
    if (!orgId) return;
    const params = new URLSearchParams();
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (flaggedOnly) params.set('flagged', 'true');
    if (unreconciledOnly) params.set('reconciled', 'false');
    const q = params.toString() ? `?${params.toString()}` : '';
    void apiRequest<{ data: Transaction[] }>(`/orgs/${orgId}/finance/transactions${q}`)
      .then((r) => setTransactions(r.data)).catch(() => {});
    void apiRequest<Summary>(`/orgs/${orgId}/finance/summary`).then(setSummary).catch(() => {});
  };

  useEffect(load, [orgId, typeFilter, flaggedOnly, unreconciledOnly]);

  async function createTransaction() {
    if (!orgId || !form.description.trim() || !form.amount) return;
    setCreating(true);
    try {
      await apiRequest(`/orgs/${orgId}/finance/transactions`, {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setForm({ type: 'expense', category: 'uncategorized', description: '', amount: '', currency: 'USD', date: new Date().toISOString().split('T')[0] ?? '', vendor: '', reference: '' });
      setShowCreate(false);
      load();
    } catch { alert('Failed to create transaction'); }
    finally { setCreating(false); }
  }

  async function reconcileSelected() {
    if (!orgId || selected.length === 0) return;
    await apiRequest(`/orgs/${orgId}/finance/transactions/reconcile`, {
      method: 'POST',
      body: JSON.stringify({ txIds: selected }),
    });
    setSelected([]);
    load();
  }

  async function unflagTx(txId: string) {
    if (!orgId) return;
    await apiRequest(`/orgs/${orgId}/finance/transactions/${txId}`, {
      method: 'PATCH',
      body: JSON.stringify({ flagged: false, flagReason: null }),
    });
    load();
  }

  function toggleSelect(txId: string) {
    setSelected((prev) => prev.includes(txId) ? prev.filter((id) => id !== txId) : [...prev, txId]);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Finance</h1>
          <p className="mt-1 text-sm text-gray-400">Track transactions, flag anomalies, and reconcile accounts</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          + Add Transaction
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Income (this month)</p>
            <p className="mt-1 text-2xl font-bold text-green-400">${summary.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Expenses</p>
            <p className="mt-1 text-2xl font-bold text-red-400">${summary.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Net</p>
            <p className={`mt-1 text-2xl font-bold ${summary.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {summary.net >= 0 ? '+' : ''}${summary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-gray-400">Flagged (unreconciled)</p>
            <p className={`mt-1 text-2xl font-bold ${summary.flaggedCount > 0 ? 'text-red-400' : 'text-white'}`}>{summary.flaggedCount}</p>
          </div>
        </div>
      )}

      {/* Top expense categories */}
      {summary && summary.topExpenseCategories.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Top Expense Categories</h2>
          <div className="space-y-2">
            {summary.topExpenseCategories.map((cat) => {
              const pct = summary.expenses > 0 ? (cat.total / summary.expenses) * 100 : 0;
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="w-28 text-xs capitalize text-gray-300 shrink-0">{cat.category}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-20 text-right">${cat.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filters + bulk actions */}
      <div className="flex flex-wrap gap-3 items-center">
        {['all', 'income', 'expense', 'transfer'].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
        <button onClick={() => setFlaggedOnly((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${flaggedOnly ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
          🚩 Flagged
        </button>
        <button onClick={() => setUnreconciledOnly((v) => !v)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${unreconciledOnly ? 'bg-yellow-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
          Unreconciled
        </button>
        {selected.length > 0 && (
          <button onClick={() => void reconcileSelected()}
            className="ml-auto rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500">
            Reconcile {selected.length} selected
          </button>
        )}
      </div>

      {/* Transaction list */}
      <div className="space-y-2">
        {transactions.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center text-gray-500">No transactions found.</div>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className={`rounded-xl border bg-white/5 p-4 ${tx.flagged ? 'border-red-500/30' : 'border-white/10'}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <input type="checkbox" checked={selected.includes(tx.id)} onChange={() => toggleSelect(tx.id)}
                  className="mt-1 accent-indigo-500" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${TYPE_STYLE[tx.type] ?? 'text-white'}`}>
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '~'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {tx.currency}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300 capitalize">{tx.category}</span>
                    {tx.flagged && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">🚩 Flagged</span>}
                    {tx.reconciled && <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600">✓ Reconciled</span>}
                  </div>
                  <p className="mt-1 text-sm text-white">{tx.description}</p>
                  {tx.vendor && <p className="text-xs text-gray-500">{tx.vendor}</p>}
                  {tx.flagReason && <p className="text-xs text-red-400 mt-1">{tx.flagReason}</p>}
                  <p className="text-xs text-gray-600 mt-1">{new Date(tx.date).toLocaleDateString()}</p>
                </div>
              </div>
              {tx.flagged && !tx.reconciled && (
                <button onClick={() => void unflagTx(tx.id)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:text-white shrink-0">
                  Unflag
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Add Transaction</h2>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {['income', 'expense', 'transfer'].map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
            <input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
            <input placeholder="Vendor (optional)" value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex gap-3 pt-2">
              <button onClick={() => void createTransaction()} disabled={creating || !form.description.trim() || !form.amount}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                {creating ? 'Adding…' : 'Add Transaction'}
              </button>
              <button onClick={() => setShowCreate(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
