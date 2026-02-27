import prisma from '../../../lib/prisma.js';

function periodToDate(period: string): Date {
  const now = new Date();
  const match = period.match(/^(\d+)d$/);
  const days = match ? parseInt(match[1], 10) : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function getAgentAnalytics(agentId: string, period: string) {
  const since = periodToDate(period);
  const stats = await prisma.agentDailyStats.aggregate({
    where: { agentId, date: { gte: since } },
    _sum: {
      totalSessions: true,
      successCount: true,
      errorCount: true,
      totalInputTokens: true,
      totalOutputTokens: true,
      totalCost: true,
    },
    _avg: { avgLatencyMs: true },
  });

  return {
    agentId,
    period,
    totalSessions: stats._sum.totalSessions ?? 0,
    successCount: stats._sum.successCount ?? 0,
    errorCount: stats._sum.errorCount ?? 0,
    totalInputTokens: stats._sum.totalInputTokens ?? 0,
    totalOutputTokens: stats._sum.totalOutputTokens ?? 0,
    totalCost: stats._sum.totalCost ?? 0,
    avgLatencyMs: stats._avg.avgLatencyMs ?? 0,
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

  const stats = await prisma.agentDailyStats.aggregate({
    where: { agentId: { in: agentIds }, date: { gte: since } },
    _sum: {
      totalSessions: true,
      successCount: true,
      errorCount: true,
      totalInputTokens: true,
      totalOutputTokens: true,
      totalCost: true,
    },
  });

  return {
    teamId,
    period,
    totalSessions: stats._sum.totalSessions ?? 0,
    successCount: stats._sum.successCount ?? 0,
    errorCount: stats._sum.errorCount ?? 0,
    totalInputTokens: stats._sum.totalInputTokens ?? 0,
    totalOutputTokens: stats._sum.totalOutputTokens ?? 0,
    totalCost: stats._sum.totalCost ?? 0,
  };
}

export async function getPlatformAnalytics(period: string) {
  const since = periodToDate(period);
  const stats = await prisma.agentDailyStats.aggregate({
    where: { date: { gte: since } },
    _sum: {
      totalSessions: true,
      successCount: true,
      errorCount: true,
      totalInputTokens: true,
      totalOutputTokens: true,
      totalCost: true,
    },
  });

  return {
    period,
    totalSessions: stats._sum.totalSessions ?? 0,
    successCount: stats._sum.successCount ?? 0,
    errorCount: stats._sum.errorCount ?? 0,
    totalInputTokens: stats._sum.totalInputTokens ?? 0,
    totalOutputTokens: stats._sum.totalOutputTokens ?? 0,
    totalCost: stats._sum.totalCost ?? 0,
  };
}

export async function getTokenTrends(agentId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const stats = await prisma.agentDailyStats.findMany({
    where: { agentId, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      totalInputTokens: true,
      totalOutputTokens: true,
      totalSessions: true,
      totalCost: true,
    },
  });

  return stats;
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
