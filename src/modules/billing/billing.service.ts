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
  const where: any = dateFilter ? { startedAt: dateFilter } : {};

  const agg = await prisma.traceSession.aggregate({
    where,
    _sum: { cost: true, tokensIn: true, tokensOut: true },
  });

  const activeAgents = await prisma.agentRegistry.count({
    where: { status: 'ACTIVE' },
  });

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const [costThisMonth, costLastMonth] = await Promise.all([
    prisma.traceSession.aggregate({
      where: { startedAt: { gte: thisMonthStart } },
      _sum: { cost: true },
    }),
    prisma.traceSession.aggregate({
      where: { startedAt: { gte: lastMonthStart, lte: lastMonthEnd } },
      _sum: { cost: true },
    }),
  ]);

  // Cost by day - last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyCosts = await prisma.$queryRaw<Array<{ date: string; cost: number }>>`
    SELECT DATE(started_at) as date, COALESCE(SUM(cost), 0)::float as cost
    FROM trace_sessions
    WHERE started_at >= ${thirtyDaysAgo}
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `;

  return {
    totalCost: Number(agg._sum.cost ?? 0),
    totalTokens: (agg._sum.tokensIn ?? 0) + (agg._sum.tokensOut ?? 0),
    activeAgents,
    costThisMonth: Number(costThisMonth._sum.cost ?? 0),
    costLastMonth: Number(costLastMonth._sum.cost ?? 0),
    costByDay: dailyCosts.map(d => ({ date: String(d.date).slice(0, 10), cost: Number(d.cost) })),
  };
}

export async function getByAgent(from?: string, to?: string) {
  const dateFilter = buildDateFilter(from, to);
  const where: any = dateFilter ? { startedAt: dateFilter } : {};

  const results = await prisma.traceSession.groupBy({
    by: ['agentId'],
    where,
    _sum: { cost: true, tokensIn: true, tokensOut: true },
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
    const totalCost = Number(r._sum.cost ?? 0);
    const sessionCount = r._count;
    return {
      agentId: r.agentId,
      agentName: agent?.name ?? 'Unknown',
      model: agent?.model ?? 'Unknown',
      totalCost,
      totalTokens: (r._sum.tokensIn ?? 0) + (r._sum.tokensOut ?? 0),
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
      COALESCE(SUM(ts.cost), 0)::float as total_cost,
      COUNT(DISTINCT ts.agent_id)::int as agent_count,
      (SELECT ar.name FROM trace_sessions ts2
       JOIN agent_registry ar ON ar.id = ts2.agent_id
       JOIN task_traces tt2 ON tt2.id = ts2.task_trace_id
       WHERE tt2.owner_id = u.id
       GROUP BY ar.name ORDER BY SUM(ts2.cost) DESC LIMIT 1) as top_agent
    FROM users u
    JOIN task_traces tt ON tt.owner_id = u.id
    JOIN trace_sessions ts ON ts.task_trace_id = tt.id
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN departments d ON e.department_id = d.id
    ${dateFilter ? Prisma.sql`WHERE ts.started_at >= ${new Date(from!)} AND ts.started_at <= ${new Date(to + 'T23:59:59.999Z')}` : Prisma.empty}
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

  const rows = await prisma.$queryRaw<Array<{
    model: string;
    total_cost: number;
    total_tokens: number;
    session_count: number;
  }>>`
    SELECT
      ar.model,
      COALESCE(SUM(ts.cost), 0)::float as total_cost,
      COALESCE(SUM(ts.tokens_in + ts.tokens_out), 0)::int as total_tokens,
      COUNT(*)::int as session_count
    FROM trace_sessions ts
    JOIN agent_registry ar ON ar.id = ts.agent_id
    ${dateFilter ? Prisma.sql`WHERE ts.started_at >= ${new Date(from!)} AND ts.started_at <= ${new Date(to + 'T23:59:59.999Z')}` : Prisma.empty}
    GROUP BY ar.model
    ORDER BY total_cost DESC
  `;

  return rows.map(r => ({
    model: r.model,
    totalCost: Number(r.total_cost),
    totalTokens: Number(r.total_tokens),
    sessionCount: Number(r.session_count),
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
      EXTRACT(MONTH FROM started_at)::int as month,
      EXTRACT(YEAR FROM started_at)::int as year,
      COALESCE(SUM(cost), 0)::float as total_cost,
      COALESCE(SUM(tokens_in + tokens_out), 0)::int as total_tokens,
      COUNT(DISTINCT agent_id)::int as agent_count
    FROM trace_sessions
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

  const rows = await prisma.$queryRaw<Array<{
    date: string;
    agent_name: string;
    model: string;
    tokens_in: number;
    tokens_out: number;
    cost: number;
  }>>`
    SELECT
      DATE(ts.started_at) as date,
      ar.name as agent_name,
      ar.model,
      ts.tokens_in,
      ts.tokens_out,
      ts.cost::float as cost
    FROM trace_sessions ts
    JOIN agent_registry ar ON ar.id = ts.agent_id
    ${dateFilter ? Prisma.sql`WHERE ts.started_at >= ${new Date(from!)} AND ts.started_at <= ${new Date(to + 'T23:59:59.999Z')}` : Prisma.empty}
    ORDER BY ts.started_at ASC
  `;

  const header = 'date,agent,model,tokens_in,tokens_out,cost';
  const csvRows = rows.map(r =>
    `${String(r.date).slice(0, 10)},${r.agent_name.replace(/,/g, ' ')},${r.model},${r.tokens_in},${r.tokens_out},${r.cost}`
  );

  return [header, ...csvRows].join('\n');
}
