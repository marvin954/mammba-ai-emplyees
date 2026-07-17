import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@nexusos/database';

export interface AnalyticsSummary {
  period: { from: string; to: string };
  agentRuns: {
    total: number;
    completed: number;
    failed: number;
    avgDurationMs: number | null;
    totalCostUsd: number;
  };
  usage: {
    totalCostUsd: number;
    totalTokens: number;
    byProvider: Record<string, { costUsd: number; tokens: number }>;
    byModel: Record<string, { costUsd: number; tokens: number }>;
  };
  topAgents: Array<{ agentId: string; name: string; runs: number; costUsd: number }>;
  dailyRuns: Array<{ date: string; total: number; completed: number; failed: number; costUsd: number }>;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: PrismaClient) {}

  async assertMember(orgId: string, userId: string): Promise<void> {
    const m = await this.db.membership.findFirst({ where: { orgId, userId } });
    if (!m) throw new ForbiddenException('Not a member of this organization');
  }

  async getSummary(orgId: string, days = 30): Promise<AnalyticsSummary> {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
    const to = new Date();

    const [runsAgg, runsAll, usageRecords, agents] = await Promise.all([
      this.db.agentRun.aggregate({
        where: { orgId, createdAt: { gte: from } },
        _count: { id: true },
        _avg: { durationMs: true },
        _sum: { costUsd: true },
      }),
      this.db.agentRun.findMany({
        where: { orgId, createdAt: { gte: from } },
        select: {
          agentId: true,
          status: true,
          costUsd: true,
          createdAt: true,
          durationMs: true,
        },
      }),
      this.db.usageRecord.findMany({
        where: { orgId, createdAt: { gte: from }, resourceType: 'ai_tokens' },
        select: { provider: true, model: true, quantity: true, totalCostUsd: true },
      }),
      this.db.agent.findMany({
        where: { orgId },
        select: { id: true, name: true },
      }),
    ]);

    const agentMap = new Map((agents as Array<{ id: string; name: string }>).map((a) => [a.id, a.name]));

    // Status counts
    const completed = (runsAll as Array<{ status: string }>).filter((r) => r.status === 'completed').length;
    const failed = (runsAll as Array<{ status: string }>).filter((r) => r.status === 'failed').length;

    // Usage by provider/model
    const byProvider: Record<string, { costUsd: number; tokens: number }> = {};
    const byModel: Record<string, { costUsd: number; tokens: number }> = {};
    let totalTokens = 0;
    for (const u of usageRecords) {
      const prov = u.provider ?? 'unknown';
      const mod = u.model ?? 'unknown';
      byProvider[prov] ??= { costUsd: 0, tokens: 0 };
      byProvider[prov].costUsd += u.totalCostUsd;
      byProvider[prov].tokens += u.quantity;
      byModel[mod] ??= { costUsd: 0, tokens: 0 };
      byModel[mod].costUsd += u.totalCostUsd;
      byModel[mod].tokens += u.quantity;
      totalTokens += u.quantity;
    }

    // Top agents
    const agentStats = new Map<string, { runs: number; costUsd: number }>();
    for (const r of runsAll) {
      const stat = agentStats.get(r.agentId) ?? { runs: 0, costUsd: 0 };
      stat.runs += 1;
      stat.costUsd += r.costUsd;
      agentStats.set(r.agentId, stat);
    }
    const topAgents = [...agentStats.entries()]
      .map(([agentId, s]) => ({ agentId, name: agentMap.get(agentId) ?? agentId, ...s }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 10);

    // Daily breakdown
    const dailyMap = new Map<string, { total: number; completed: number; failed: number; costUsd: number }>();
    for (const r of runsAll) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const d = dailyMap.get(day) ?? { total: 0, completed: 0, failed: 0, costUsd: 0 };
      d.total += 1;
      if (r.status === 'completed') d.completed += 1;
      if (r.status === 'failed') d.failed += 1;
      d.costUsd += r.costUsd;
      dailyMap.set(day, d);
    }
    const dailyRuns = [...dailyMap.entries()]
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      agentRuns: {
        total: runsAgg._count.id,
        completed,
        failed,
        avgDurationMs: runsAgg._avg.durationMs,
        totalCostUsd: runsAgg._sum.costUsd ?? 0,
      },
      usage: {
        totalCostUsd: runsAgg._sum.costUsd ?? 0,
        totalTokens,
        byProvider,
        byModel,
      },
      topAgents: topAgents as Array<{ agentId: string; name: string; runs: number; costUsd: number }>,
      dailyRuns,
    };
  }

  async getRunTimeline(
    orgId: string,
    days = 7,
  ): Promise<Array<{ agentRunId: string; agentName: string; status: string; durationMs: number | null; costUsd: number; createdAt: string }>> {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const runs = await this.db.agentRun.findMany({
      where: { orgId, createdAt: { gte: from } },
      select: {
        id: true,
        status: true,
        durationMs: true,
        costUsd: true,
        createdAt: true,
        agent: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return runs.map((r: { id: string; status: string; durationMs: number | null; costUsd: number; createdAt: Date; agent: { name: string } }) => ({
      agentRunId: r.id,
      agentName: r.agent.name,
      status: r.status,
      durationMs: r.durationMs,
      costUsd: r.costUsd,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
