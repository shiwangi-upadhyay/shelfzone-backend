import prisma from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';

function buildDateFilter(from?: string, to?: string) {
  const filter: any = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to + 'T23:59:59.999Z');
  return Object.keys(filter).length ? filter : undefined;
}

export async function getSummary(from?: string, to?: string) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { createdAt: dateFilter } : {};

  const agg = await prisma.agentSession.aggregate({
    where,
    _sum: { cost: true, totalTokens: true },
  });

  const activeAgents = await prisma.agentRegistry.count({
    where: { status: 'ACTIVE' },
  });

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [costThisMonth, costLastMonth] = await Promise.all([
    prisma.agentSession.aggregate({
      where: { createdAt: { gte: thisMonthStart } },
      _sum: { cost: true },
    }),
    prisma.agentSession.aggregate({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { cost: true },
    }),
  ]);

  // Cost by day - last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyCosts = await prisma.$queryRaw<Array<{ date: string; cost: number }>>`
    SELECT DATE(created_at) as date, COALESCE(SUM(cost), 0)::float as cost
    FROM agent_sessions
    WHERE created_at >= ${thirtyDaysAgo}
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return {
    totalCost: agg._sum.cost ?? 0,
    totalTokens: agg._sum.totalTokens ?? 0,
    activeAgents,
    costThisMonth: costThisMonth._sum.cost ?? 0,
    costLastMonth: costLastMonth._sum.cost ?? 0,
    costByDay: dailyCosts.map(d => ({ date: String(d.date).slice(0, 10), cost: Number(d.cost) })),
  };
}

export async function getByAgent(from?: string, to?: string) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { createdAt: dateFilter } : {};

  const results = await prisma.agentSession.groupBy({
    by: ['agentId'],
    where,
    _sum: { cost: true, totalTokens: true },
    _count: true,
    orderBy: { _sum: { cost: 'desc' } },
  });

  const agentIds = results.map(r => r.agentId);
  const agents = await prisma.agentRegistry.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, model: true },
  });
  const agentMap = new Map(agents.map(a => [a.id, a]));

  return results.map(r => {
    const agent = agentMap.get(r.agentId);
    const totalCost = r._sum.cost ?? 0;
    const sessionCount = r._count;
    return {
      agentId: r.agentId,
      agentName: agent?.name ?? 'Unknown',
      model: agent?.model ?? 'Unknown',
      totalCost,
      totalTokens: r._sum.totalTokens ?? 0,
      sessionCount,
      avgCostPerSession: sessionCount > 0 ? Math.round((totalCost / sessionCount) * 1e6) / 1e6 : 0,
    };
  });
}

export async function getByEmployee(from?: string, to?: string) {
  const dateFilter = buildDateFilter(from, to);

  const rows = await prisma.$queryRaw<Array<{
    user_id: string;
    name: string;
    department: string | null;
    total_cost: number;
    agent_count: number;
    top_agent: string | null;
  }>>`
    SELECT
      u.id as user_id,
      COALESCE(e.first_name || ' ' || e.last_name, u.email) as name,
      d.name as department,
      COALESCE(SUM(s.cost), 0)::float as total_cost,
      COUNT(DISTINCT s.agent_id)::int as agent_count,
      (SELECT ar.name FROM agent_sessions s2
       JOIN agent_registry ar ON ar.id = s2.agent_id
       WHERE s2.user_id = u.id
       GROUP BY ar.name ORDER BY SUM(s2.cost) DESC LIMIT 1) as top_agent
    FROM users u
    LEFT JOIN agent_sessions s ON s.user_id = u.id
      ${dateFilter ? Prisma.sql`AND s.created_at >= ${new Date(from!)} AND s.created_at <= ${new Date(to + 'T23:59:59.999Z')}` : Prisma.empty}
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE s.id IS NOT NULL
    GROUP BY u.id, e.first_name, e.last_name, u.email, d.name
    ORDER BY total_cost DESC
  `;

  return rows.map(r => ({
    employeeId: r.user_id,
    name: r.name,
    department: r.department ?? 'N/A',
    totalCost: Number(r.total_cost),
    agentCount: Number(r.agent_count),
    topAgent: r.top_agent ?? 'N/A',
  }));
}

export async function getByModel(from?: string, to?: string) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { createdAt: dateFilter } : {};

  const results = await prisma.agentCostLedger.groupBy({
    by: ['model'],
    where,
    _sum: { totalCost: true, inputTokens: true, outputTokens: true },
    _count: true,
    orderBy: { _sum: { totalCost: 'desc' } },
  });

  return results.map(r => ({
    model: r.model,
    totalCost: r._sum.totalCost ?? 0,
    totalTokens: (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
    sessionCount: r._count,
  }));
}

export async function getInvoices() {
  const rows = await prisma.$queryRaw<Array<{
    month: number;
    year: number;
    total_cost: number;
    total_tokens: number;
    agent_count: number;
  }>>`
    SELECT
      EXTRACT(MONTH FROM created_at)::int as month,
      EXTRACT(YEAR FROM created_at)::int as year,
      COALESCE(SUM(cost), 0)::float as total_cost,
      COALESCE(SUM(total_tokens), 0)::int as total_tokens,
      COUNT(DISTINCT agent_id)::int as agent_count
    FROM agent_sessions
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  return rows.map(r => ({
    month: r.month,
    year: r.year,
    totalCost: Number(r.total_cost),
    totalTokens: Number(r.total_tokens),
    agentCount: Number(r.agent_count),
    status: (r.year < currentYear || (r.year === currentYear && r.month < currentMonth)) ? 'paid' as const : 'pending' as const,
  }));
}

export async function getExportCsv(from?: string, to?: string) {
  const dateFilter = buildDateFilter(from, to);
  const where = dateFilter ? { createdAt: dateFilter } : {};

  const ledgerEntries = await prisma.agentCostLedger.findMany({
    where,
    include: { agent: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const header = 'date,agent,model,tokens_in,tokens_out,cost';
  const rows = ledgerEntries.map(e =>
    `${e.createdAt.toISOString().slice(0, 10)},${e.agent.name.replace(/,/g, ' ')},${e.model},${e.inputTokens},${e.outputTokens},${e.totalCost}`
  );

  return [header, ...rows].join('\n');
}
