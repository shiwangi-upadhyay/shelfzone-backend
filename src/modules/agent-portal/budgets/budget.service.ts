import prisma from '../../../lib/prisma.js';

interface SetBudgetData {
  agentId?: string;
  teamId?: string;
  monthlyCapUsd: number;
  month: number;
  year: number;
}

interface BudgetQuery {
  page: number;
  limit: number;
  agentId?: string;
  teamId?: string;
  month?: number;
  year?: number;
}

export async function setBudget(data: SetBudgetData) {
  // Prisma unique constraint requires non-null or specific handling
  const existing = await prisma.agentBudget.findFirst({
    where: {
      agentId: data.agentId ?? null,
      teamId: data.teamId ?? null,
      month: data.month,
      year: data.year,
    },
  });

  if (existing) {
    return prisma.agentBudget.update({
      where: { id: existing.id },
      data: { monthlyCapUsd: data.monthlyCapUsd },
    });
  }

  return prisma.agentBudget.create({
    data: {
      agentId: data.agentId,
      teamId: data.teamId,
      monthlyCapUsd: data.monthlyCapUsd,
      month: data.month,
      year: data.year,
    },
  });
}

export async function getBudgets(query: BudgetQuery) {
  const { page, limit, agentId, teamId, month, year } = query;
  const where: Record<string, unknown> = {};
  if (agentId) where.agentId = agentId;
  if (teamId) where.teamId = teamId;
  if (month) where.month = month;
  if (year) where.year = year;

  const [data, total] = await Promise.all([
    prisma.agentBudget.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    }),
    prisma.agentBudget.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function checkBudget(agentId: string) {
  const now = new Date();
  const budget = await prisma.agentBudget.findFirst({
    where: {
      agentId,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    },
  });

  if (!budget) return { hasBudget: false, percentage: 0, alerts: [], shouldPause: false };

  const percentage = (budget.currentSpend / budget.monthlyCapUsd) * 100;
  const alerts: string[] = [];
  if (percentage >= 60) alerts.push('60% threshold reached');
  if (percentage >= 80) alerts.push('80% threshold reached');
  if (percentage >= 100) alerts.push('100% threshold reached — budget exceeded');

  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    select: { isCritical: true },
  });
  const shouldPause = percentage >= 100 && budget.autoPauseEnabled && !agent?.isCritical;

  return {
    hasBudget: true,
    budgetId: budget.id,
    monthlyCapUsd: budget.monthlyCapUsd,
    currentSpend: budget.currentSpend,
    percentage,
    alerts,
    shouldPause,
    isPaused: budget.isPaused,
  };
}

export async function autoPause(agentId: string) {
  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    select: { isCritical: true },
  });
  if (agent?.isCritical) return { paused: false, reason: 'Agent is critical — cannot auto-pause' };

  await prisma.agentRegistry.update({ where: { id: agentId }, data: { status: 'PAUSED' } });

  const now = new Date();
  await prisma.agentBudget.updateMany({
    where: { agentId, month: now.getMonth() + 1, year: now.getFullYear() },
    data: { isPaused: true, pausedAt: now },
  });

  return { paused: true };
}

export async function unpause(agentId: string, userId: string) {
  await prisma.agentRegistry.update({ where: { id: agentId }, data: { status: 'ACTIVE' } });

  const now = new Date();
  await prisma.agentBudget.updateMany({
    where: { agentId, month: now.getMonth() + 1, year: now.getFullYear() },
    data: { isPaused: false, pausedBy: userId },
  });

  await prisma.agentConfigLog.create({
    data: {
      agentId,
      changedBy: userId,
      changeType: 'UNPAUSE',
      previousValue: { status: 'PAUSED' },
      newValue: { status: 'ACTIVE' },
      reason: 'Manual unpause by admin',
    },
  });

  return { unpaused: true };
}
