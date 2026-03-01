import prisma from '../../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

function periodToDate(period: string): Date {
  const match = period.match(/^(\d+)d$/);
  const days = match ? parseInt(match[1], 10) : 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getAgentCosts(agentId: string, period: string) {
  const since = periodToDate(period);
  
  // Query trace_sessions as the single source of truth for billing data
  const [aggregate, breakdown] = await Promise.all([
    prisma.traceSession.aggregate({
      where: { agentId, startedAt: { gte: since } },
      _sum: {
        cost: true,
        tokensIn: true,
        tokensOut: true,
      },
    }),
    prisma.traceSession.groupBy({
      by: ['modelUsed'],
      where: { agentId, startedAt: { gte: since }, modelUsed: { not: null } },
      _sum: { cost: true, tokensIn: true, tokensOut: true },
    }),
  ]);

  const totalCost = Number(aggregate._sum.cost ?? 0);
  const totalInputTokens = aggregate._sum.tokensIn ?? 0;
  const totalOutputTokens = aggregate._sum.tokensOut ?? 0;

  // Estimate input/output costs based on typical token pricing ratios
  // Typically input:output cost ratio is ~1:3 for most models
  const totalInputCost = totalCost * 0.25;
  const totalOutputCost = totalCost * 0.75;

  return {
    agentId,
    period,
    totalInputCost,
    totalOutputCost,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
    byModel: breakdown.map(b => ({
      model: b.modelUsed,
      _sum: {
        totalCost: Number(b._sum.cost ?? 0),
        inputTokens: b._sum.tokensIn,
        outputTokens: b._sum.tokensOut,
      }
    })),
  };
}

export async function getTeamCosts(teamId: string, period: string) {
  const since = periodToDate(period);
  const agents = await prisma.agentRegistry.findMany({ where: { teamId }, select: { id: true } });
  const agentIds = agents.map((a) => a.id);

  if (agentIds.length === 0) return { 
    teamId, 
    period, 
    totalInputCost: 0,
    totalOutputCost: 0,
    totalCost: 0 
  };

  // Query trace_sessions as the single source of truth
  const stats = await prisma.traceSession.aggregate({
    where: { agentId: { in: agentIds }, startedAt: { gte: since } },
    _sum: { cost: true },
  });

  const totalCost = Number(stats._sum.cost ?? 0);
  const totalInputCost = totalCost * 0.25;
  const totalOutputCost = totalCost * 0.75;

  return {
    teamId,
    period,
    totalInputCost,
    totalOutputCost,
    totalCost,
  };
}

export async function getPlatformCosts(period: string) {
  const since = periodToDate(period);
  
  // Query trace_sessions as the single source of truth for billing data
  const stats = await prisma.traceSession.aggregate({
    where: { startedAt: { gte: since } },
    _sum: {
      cost: true,
      tokensIn: true,
      tokensOut: true,
    },
  });

  const totalCost = Number(stats._sum.cost ?? 0);
  const totalInputTokens = stats._sum.tokensIn ?? 0;
  const totalOutputTokens = stats._sum.tokensOut ?? 0;

  // Estimate input/output costs based on typical token pricing ratios
  const totalInputCost = totalCost * 0.25;
  const totalOutputCost = totalCost * 0.75;

  return {
    period,
    totalInputCost,
    totalOutputCost,
    totalCost,
    totalInputTokens,
    totalOutputTokens,
  };
}

export async function getCostBreakdown(
  period: string,
  groupBy: 'agent' | 'team' | 'model' | 'day',
) {
  const since = periodToDate(period);

  if (groupBy === 'model') {
    // Query trace_sessions and group by modelUsed
    return prisma.traceSession.groupBy({
      by: ['modelUsed'],
      where: { startedAt: { gte: since }, modelUsed: { not: null } },
      _sum: { cost: true, tokensIn: true, tokensOut: true },
      orderBy: { _sum: { cost: 'desc' } },
    }).then(results => 
      results.map(r => ({
        model: r.modelUsed,
        totalCost: Number(r._sum.cost ?? 0),
        inputTokens: r._sum.tokensIn,
        outputTokens: r._sum.tokensOut,
      }))
    );
  }

  if (groupBy === 'agent') {
    // Query trace_sessions and group by agentId
    return prisma.traceSession.groupBy({
      by: ['agentId'],
      where: { startedAt: { gte: since } },
      _sum: { cost: true, tokensIn: true, tokensOut: true },
      orderBy: { _sum: { cost: 'desc' } },
    }).then(results =>
      results.map(r => ({
        agentId: r.agentId,
        totalCost: Number(r._sum.cost ?? 0),
        inputTokens: r._sum.tokensIn,
        outputTokens: r._sum.tokensOut,
      }))
    );
  }

  if (groupBy === 'day') {
    // Query trace_sessions grouped by date
    const raw = await prisma.$queryRaw<
      Array<{ day: Date; total_cost: number; input_tokens: bigint; output_tokens: bigint }>
    >`
      SELECT DATE(started_at) as day, SUM(cost) as total_cost, SUM(tokens_in)::bigint as input_tokens, SUM(tokens_out)::bigint as output_tokens
      FROM trace_sessions
      WHERE started_at >= ${since}
      GROUP BY DATE(started_at)
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
  
  // Query trace_sessions and group by agentId
  const ledger = await prisma.traceSession.groupBy({
    by: ['agentId'],
    where: { startedAt: { gte: since }, agentId: { in: Array.from(agentTeamMap.keys()) } },
    _sum: { cost: true },
  });

  const teamTotals = new Map<string, number>();
  for (const entry of ledger) {
    const teamId = agentTeamMap.get(entry.agentId);
    if (teamId) {
      teamTotals.set(teamId, (teamTotals.get(teamId) ?? 0) + Number(entry._sum.cost ?? 0));
    }
  }

  return Array.from(teamTotals.entries())
    .map(([teamId, totalCost]) => ({ teamId, totalCost }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
