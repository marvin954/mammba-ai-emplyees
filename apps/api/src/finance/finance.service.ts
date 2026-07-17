import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

export interface CreateTransactionInput {
  type: 'income' | 'expense' | 'transfer';
  category?: string;
  description: string;
  amount: number;
  currency?: string;
  date: string;
  reference?: string;
  vendor?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTransactionInput {
  category?: string;
  description?: string;
  reconciled?: boolean;
  flagged?: boolean;
  flagReason?: string;
  metadata?: Record<string, unknown>;
}

const AUTO_FLAG_THRESHOLD = 10_000;

@Injectable()
export class FinanceService {
  constructor(private readonly db: PrismaClient) {}

  // ─── Transactions ─────────────────────────────────────────────────────────

  async listTransactions(
    orgId: string,
    options: {
      type?: string;
      category?: string;
      flagged?: boolean;
      reconciled?: boolean;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 25, 100);
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      ...(options.type ? { type: options.type } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.flagged !== undefined ? { flagged: options.flagged } : {}),
      ...(options.reconciled !== undefined ? { reconciled: options.reconciled } : {}),
      ...(options.from || options.to
        ? {
            date: {
              ...(options.from ? { gte: new Date(options.from) } : {}),
              ...(options.to ? { lte: new Date(options.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.financialTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.db.financialTransaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getTransaction(orgId: string, txId: string) {
    const tx = await this.db.financialTransaction.findFirst({ where: { id: txId, orgId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  async createTransaction(orgId: string, input: CreateTransactionInput, createdById: string) {
    const flagged = Math.abs(input.amount) >= AUTO_FLAG_THRESHOLD;

    return this.db.financialTransaction.create({
      data: {
        orgId,
        type: input.type,
        category: input.category ?? 'uncategorized',
        description: input.description,
        amount: input.amount,
        currency: input.currency ?? 'USD',
        date: new Date(input.date),
        reference: input.reference ?? null,
        vendor: input.vendor ?? null,
        flagged,
        flagReason: flagged ? `Auto-flagged: amount ≥ $${AUTO_FLAG_THRESHOLD.toLocaleString()}` : null,
        metadata: (input.metadata ?? {}) as never,
        createdById,
      },
    });
  }

  async updateTransaction(orgId: string, txId: string, input: UpdateTransactionInput) {
    await this.getTransaction(orgId, txId);
    return this.db.financialTransaction.update({
      where: { id: txId },
      data: { ...input, metadata: input.metadata as never },
    });
  }

  async deleteTransaction(orgId: string, txId: string) {
    await this.getTransaction(orgId, txId);
    await this.db.financialTransaction.delete({ where: { id: txId } });
  }

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary(orgId: string, options: { month?: string } = {}) {
    const now = new Date();
    const year = now.getFullYear();
    const month = options.month ? Number(options.month) - 1 : now.getMonth();

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);

    const [byType, flaggedCount, unreconciledCount, byCategory] = await Promise.all([
      this.db.financialTransaction.groupBy({
        by: ['type'],
        where: { orgId, date: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      this.db.financialTransaction.count({ where: { orgId, flagged: true, reconciled: false } }),
      this.db.financialTransaction.count({ where: { orgId, reconciled: false } }),
      this.db.financialTransaction.groupBy({
        by: ['category'],
        where: { orgId, type: 'expense', date: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 8,
      }),
    ]);

    const income = byType.find((r) => r.type === 'income')?._sum.amount ?? 0;
    const expenses = byType.find((r) => r.type === 'expense')?._sum.amount ?? 0;

    return {
      period: { start: start.toISOString(), end: end.toISOString() },
      income,
      expenses,
      net: income - expenses,
      flaggedCount,
      unreconciledCount,
      topExpenseCategories: byCategory.map((r) => ({
        category: r.category,
        total: r._sum.amount ?? 0,
        count: r._count,
      })),
    };
  }

  async bulkReconcile(orgId: string, txIds: string[]) {
    const result = await this.db.financialTransaction.updateMany({
      where: { orgId, id: { in: txIds } },
      data: { reconciled: true },
    });
    return { reconciled: result.count };
  }
}
