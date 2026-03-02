import { prisma } from '../../lib/prisma.js';

export interface AgentSpend {
  agentId: string;
  agentName: string;
  totalCost: number;
  totalTokens: number;
  sessionCount: number;
}

export interface DailySpend {
  date: string;
  totalCost: number;
  agents: AgentSpend[];
}

export interface BillingOverview {
  totalAllTime: number;
  totalThisMonth: number;
  totalThisWeek: number;
  totalToday: number;
  agentBreakdown: AgentSpend[];
  dailyBreakdown: DailySpend[];
}

export class BillingService {
  /**
   * Get total spend by agent (all time)
   */
  async getAgentSpendAllTime(userId: string): Promise<AgentSpend[]> {
    const sessions = await prisma.traceSession.findMany({
      where: {
        taskTrace: {
          ownerId: userId,
        },
        status: 'success',
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    const agentMap = new Map<string, AgentSpend>();

    for (const session of sessions) {
      if (!session.agent) continue;

      const agentId = session.agent.id;
      const agentName = session.agent.name;
      const cost = session.cost ? parseFloat(session.cost.toString()) : 0;
      const tokensIn = session.tokensIn || 0;
      const tokensOut = session.tokensOut || 0;
      const totalTokens = tokensIn + tokensOut;

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agentId,
          agentName,
          totalCost: 0,
          totalTokens: 0,
          sessionCount: 0,
        });
      }

      const agentData = agentMap.get(agentId)!;
      agentData.totalCost += cost;
      agentData.totalTokens += totalTokens;
      agentData.sessionCount += 1;
    }

    return Array.from(agentMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Get total spend for a date range
   */
  async getTotalSpendForRange(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const sessions = await prisma.traceSession.findMany({
      where: {
        taskTrace: {
          ownerId: userId,
        },
        status: 'success',
        startedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        cost: true,
      },
    });

    return sessions.reduce((total, session) => {
      const cost = session.cost ? parseFloat(session.cost.toString()) : 0;
      return total + cost;
    }, 0);
  }

  /**
   * Get daily spend breakdown for last N days
   */
  async getDailySpendBreakdown(userId: string, days: number = 30): Promise<DailySpend[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const sessions = await prisma.traceSession.findMany({
      where: {
        taskTrace: {
          ownerId: userId,
        },
        status: 'success',
        startedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        startedAt: 'asc',
      },
    });

    // Group by date
    const dateMap = new Map<string, { totalCost: number; agentMap: Map<string, AgentSpend> }>();

    for (const session of sessions) {
      if (!session.agent || !session.startedAt) continue;

      const date = session.startedAt.toISOString().split('T')[0]; // YYYY-MM-DD
      const cost = session.cost ? parseFloat(session.cost.toString()) : 0;
      const tokensIn = session.tokensIn || 0;
      const tokensOut = session.tokensOut || 0;
      const totalTokens = tokensIn + tokensOut;

      if (!dateMap.has(date)) {
        dateMap.set(date, {
          totalCost: 0,
          agentMap: new Map(),
        });
      }

      const dateData = dateMap.get(date)!;
      dateData.totalCost += cost;

      const agentId = session.agent.id;
      const agentName = session.agent.name;

      if (!dateData.agentMap.has(agentId)) {
        dateData.agentMap.set(agentId, {
          agentId,
          agentName,
          totalCost: 0,
          totalTokens: 0,
          sessionCount: 0,
        });
      }

      const agentData = dateData.agentMap.get(agentId)!;
      agentData.totalCost += cost;
      agentData.totalTokens += totalTokens;
      agentData.sessionCount += 1;
    }

    // Convert to array
    const result: DailySpend[] = [];
    dateMap.forEach((data, date) => {
      result.push({
        date,
        totalCost: data.totalCost,
        agents: Array.from(data.agentMap.values()).sort((a, b) => b.totalCost - a.totalCost),
      });
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get billing overview with all metrics
   */
  async getBillingOverview(userId: string): Promise<BillingOverview> {
    // Get all-time agent breakdown
    const agentBreakdown = await this.getAgentSpendAllTime(userId);

    // Calculate date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get totals for different ranges
    const [totalToday, totalThisWeek, totalThisMonth, dailyBreakdown] = await Promise.all([
      this.getTotalSpendForRange(userId, todayStart, now),
      this.getTotalSpendForRange(userId, weekStart, now),
      this.getTotalSpendForRange(userId, monthStart, now),
      this.getDailySpendBreakdown(userId, 30),
    ]);

    const totalAllTime = agentBreakdown.reduce((sum, agent) => sum + agent.totalCost, 0);

    return {
      totalAllTime,
      totalThisMonth,
      totalThisWeek,
      totalToday,
      agentBreakdown,
      dailyBreakdown,
    };
  }
}

export const billingService = new BillingService();
