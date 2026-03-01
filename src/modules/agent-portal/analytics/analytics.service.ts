import prisma from '../../../lib/prisma.js';

function periodToDate(period: string): Date {
  const now = new Date();
  const match = period.match(/^(\d+)d$/);
  const days = match ? parseInt(match[1], 10) : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getAgentAnalytics(agentId: string, period: string) {
  const since = periodToDate(period);
  
  // Query trace_sessions as the single source of truth
  const stats = await prisma.traceSession.aggregate({
    where: { agentId, startedAt: { gte: since } },
    _sum: {
      cost: true,
      tokensIn: true,
      tokensOut: true,
      durationMs: true,
    },
    _count: true,
    _avg: { durationMs: true },
  });

  const [successCount, errorCount] = await Promise.all([
    prisma.traceSession.count({
      where: { agentId, startedAt: { gte: since }, status: 'success' },
    }),
    prisma.traceSession.count({
      where: { agentId, startedAt: { gte: since }, status: { in: ['error', 'timeout'] } },
    }),
  ]);

  return {
    agentId,
    period,
    totalSessions: stats._count ?? 0,
    successCount,
    errorCount,
    totalInputTokens: stats._sum.tokensIn ?? 0,
    totalOutputTokens: stats._sum.tokensOut ?? 0,
    totalCost: Number(stats._sum.cost ?? 0),
    avgLatencyMs: stats._avg.durationMs ?? 0,
  };
}

export async function getTeamAnalytics(teamId: string, period: string) {
  const since = periodToDate(period);
  const agents = await prisma.agentRegistry.findMany({
    where: { teamId },
    select: { id: true },
  });
  const agentIds = agents.map((a) => a.id);

  if (agentIds.length === 0) {
    return {
      teamId,
      period,
      totalSessions: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  // Query trace_sessions as the single source of truth
  const stats = await prisma.traceSession.aggregate({
    where: { agentId: { in: agentIds }, startedAt: { gte: since } },
    _sum: {
      cost: true,
      tokensIn: true,
      tokensOut: true,
    },
    _count: true,
  });

  const [successCount, errorCount] = await Promise.all([
    prisma.traceSession.count({
      where: { agentId: { in: agentIds }, startedAt: { gte: since }, status: 'success' },
    }),
    prisma.traceSession.count({
      where: { agentId: { in: agentIds }, startedAt: { gte: since }, status: { in: ['error', 'timeout'] } },
    }),
  ]);

  return {
    teamId,
    period,
    totalSessions: stats._count ?? 0,
    successCount,
    errorCount,
    totalInputTokens: stats._sum.tokensIn ?? 0,
    totalOutputTokens: stats._sum.tokensOut ?? 0,
    totalCost: Number(stats._sum.cost ?? 0),
  };
}

export async function getPlatformAnalytics(period: string) {
  const since = periodToDate(period);
  
  // Query trace_sessions as the single source of truth for billing data
  const stats = await prisma.traceSession.aggregate({
    where: { startedAt: { gte: since } },
    _sum: {
      cost: true,
      tokensIn: true,
      tokensOut: true,
    },
    _count: true,
  });

  // Count success/error sessions based on status if available
  const [successCount, errorCount] = await Promise.all([
    prisma.traceSession.count({
      where: { startedAt: { gte: since }, status: 'success' },
    }),
    prisma.traceSession.count({
      where: { startedAt: { gte: since }, status: { in: ['error', 'timeout'] } },
    }),
  ]);

  return {
    period,
    totalSessions: stats._count ?? 0,
    successCount,
    errorCount,
    totalInputTokens: stats._sum.tokensIn ?? 0,
    totalOutputTokens: stats._sum.tokensOut ?? 0,
    totalCost: Number(stats._sum.cost ?? 0),
  };
}

export async function getTokenTrends(agentId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Query trace_sessions grouped by date
  const stats = await prisma.$queryRaw<Array<{
    date: Date;
    total_input_tokens: number;
    total_output_tokens: number;
    total_sessions: number;
    total_cost: number;
  }>>`
    SELECT
      DATE(started_at) as date,
      COALESCE(SUM(tokens_in), 0)::int as total_input_tokens,
      COALESCE(SUM(tokens_out), 0)::int as total_output_tokens,
      COUNT(*)::int as total_sessions,
      COALESCE(SUM(cost), 0)::float as total_cost
    FROM trace_sessions
    WHERE agent_id = ${agentId} AND started_at >= ${since}
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `;

  return stats.map(s => ({
    date: s.date,
    totalInputTokens: Number(s.total_input_tokens),
    totalOutputTokens: Number(s.total_output_tokens),
    totalSessions: Number(s.total_sessions),
    totalCost: Number(s.total_cost),
  }));
}

export async function getAgentEfficiency(agentId: string, period: string) {
  const analytics = await getAgentAnalytics(agentId, period);
  const { calculateEfficiencyScore } = await import('../../../lib/efficiency-scorer.js');

  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    select: { model: true },
  });

  const score = calculateEfficiencyScore({
    totalSessions: analytics.totalSessions,
    successCount: analytics.successCount,
    errorCount: analytics.errorCount,
    totalCost: analytics.totalCost,
    avgLatencyMs: analytics.avgLatencyMs,
    totalInputTokens: analytics.totalInputTokens,
    totalOutputTokens: analytics.totalOutputTokens,
    model: agent?.model ?? 'unknown',
  });

  return { agentId, period, ...score };
}
