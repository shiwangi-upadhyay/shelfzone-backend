import prisma from '../../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

function periodToDate(period: string): Date {
  const match = period.match(/^(\d+)d$/);
  const days = match ? parseInt(match[1], 10) : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getAgentCosts(agentId: string, period: string) {
  const since = periodToDate(period);
  const [aggregate, breakdown] = await Promise.all([
    prisma.agentCostLedger.aggregate({
      where: { agentId, createdAt: { gte: since } },
      _sum: {
        inputCost: true,
        outputCost: true,
        totalCost: true,
        inputTokens: true,
        outputTokens: true,
      },
    }),
    prisma.agentCostLedger.groupBy({
      by: ['model'],
      where: { agentId, createdAt: { gte: since } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true },
    }),
  ]);

  return {
    agentId,
    period,
    totalInputCost: aggregate._sum.inputCost ?? 0,
    totalOutputCost: aggregate._sum.outputCost ?? 0,
    totalCost: aggregate._sum.totalCost ?? 0,
    totalInputTokens: aggregate._sum.inputTokens ?? 0,
    totalOutputTokens: aggregate._sum.outputTokens ?? 0,
    byModel: breakdown,
  };
}

export async function getTeamCosts(teamId: string, period: string) {
  const since = periodToDate(period);
  const agents = await prisma.agentRegistry.findMany({ where: { teamId }, select: { id: true } });
  const agentIds = agents.map((a) => a.id);

  if (agentIds.length === 0) return { teamId, period, totalCost: 0 };

  const stats = await prisma.agentCostLedger.aggregate({
    where: { agentId: { in: agentIds }, createdAt: { gte: since } },
    _sum: { inputCost: true, outputCost: true, totalCost: true },
  });

  return {
    teamId,
    period,
    totalInputCost: stats._sum.inputCost ?? 0,
    totalOutputCost: stats._sum.outputCost ?? 0,
    totalCost: stats._sum.totalCost ?? 0,
  };
}

export async function getPlatformCosts(period: string) {
  const since = periodToDate(period);
  const stats = await prisma.agentCostLedger.aggregate({
    where: { createdAt: { gte: since } },
    _sum: {
      inputCost: true,
      outputCost: true,
      totalCost: true,
      inputTokens: true,
      outputTokens: true,
    },
  });

  return {
    period,
    totalInputCost: stats._sum.inputCost ?? 0,
    totalOutputCost: stats._sum.outputCost ?? 0,
    totalCost: stats._sum.totalCost ?? 0,
    totalInputTokens: stats._sum.inputTokens ?? 0,
    totalOutputTokens: stats._sum.outputTokens ?? 0,
  };
}

export async function getCostBreakdown(
  period: string,
  groupBy: 'agent' | 'team' | 'model' | 'day',
) {
  const since = periodToDate(period);

  if (groupBy === 'model') {
    return prisma.agentCostLedger.groupBy({
      by: ['model'],
      where: { createdAt: { gte: since } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true },
      orderBy: { _sum: { totalCost: 'desc' } },
    });
  }

  if (groupBy === 'agent') {
    return prisma.agentCostLedger.groupBy({
      by: ['agentId'],
      where: { createdAt: { gte: since } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true },
      orderBy: { _sum: { totalCost: 'desc' } },
    });
  }

  if (groupBy === 'day') {
    const raw = await prisma.$queryRaw<
      Array<{ day: Date; total_cost: number; input_tokens: bigint; output_tokens: bigint }>
    >`
      SELECT DATE(created_at) as day, SUM(total_cost) as total_cost, SUM(input_tokens)::bigint as input_tokens, SUM(output_tokens)::bigint as output_tokens
      FROM agent_cost_ledger
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `;
    return raw.map((r) => ({
      day: r.day,
      totalCost: Number(r.total_cost),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
    }));
  }

  // groupBy === 'team'
  const agents = await prisma.agentRegistry.findMany({
    where: { teamId: { not: null } },
    select: { id: true, teamId: true },
  });
  const agentTeamMap = new Map(agents.map((a) => [a.id, a.teamId!]));
  const ledger = await prisma.agentCostLedger.groupBy({
    by: ['agentId'],
    where: { createdAt: { gte: since }, agentId: { in: Array.from(agentTeamMap.keys()) } },
    _sum: { totalCost: true },
  });

  const teamTotals = new Map<string, number>();
  for (const entry of ledger) {
    const teamId = agentTeamMap.get(entry.agentId);
    if (teamId) {
      teamTotals.set(teamId, (teamTotals.get(teamId) ?? 0) + (entry._sum.totalCost ?? 0));
    }
  }

  return Array.from(teamTotals.entries())
    .map(([teamId, totalCost]) => ({ teamId, totalCost }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
