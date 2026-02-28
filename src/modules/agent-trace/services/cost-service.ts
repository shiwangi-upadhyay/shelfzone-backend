import prisma from '../../../lib/prisma.js';
import { Prisma } from '@prisma/client';

export async function calculateAgentCost(
  agentId: string,
  dateRange?: { from?: string; to?: string },
) {
  const where: Prisma.TraceSessionWhereInput = { agentId };
  if (dateRange?.from || dateRange?.to) {
    where.startedAt = {};
    if (dateRange.from) where.startedAt.gte = new Date(dateRange.from);
    if (dateRange.to) where.startedAt.lte = new Date(dateRange.to);
  }

  const result = await prisma.traceSession.aggregate({
    where,
    _sum: { cost: true, tokensIn: true, tokensOut: true },
    _count: true,
  });

  return {
    agentId,
    totalCost: Number(result._sum.cost ?? 0),
    totalTokensIn: result._sum.tokensIn ?? 0,
    totalTokensOut: result._sum.tokensOut ?? 0,
    sessionCount: result._count,
  };
}

export async function getSubAgentBreakdown(agentId: string) {
  // Find all traces where this agent is master, then group sessions by agent
  const traces = await prisma.taskTrace.findMany({
    where: { masterAgentId: agentId },
    select: { id: true },
  });
  const traceIds = traces.map((t) => t.id);

  if (traceIds.length === 0) return { data: [], totalCost: 0 };

  const sessions = await prisma.traceSession.groupBy({
    by: ['agentId'],
    where: { taskTraceId: { in: traceIds } },
    _sum: { cost: true, tokensIn: true, tokensOut: true },
    _count: true,
  });

  // Fetch agent names
  const agentIds = sessions.map((s) => s.agentId);
  const agents = await prisma.agentRegistry.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, slug: true },
  });
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const breakdown = sessions.map((s) => ({
    agentId: s.agentId,
    agentName: agentMap.get(s.agentId)?.name ?? 'Unknown',
    totalCost: Number(s._sum.cost ?? 0),
    totalTokensIn: s._sum.tokensIn ?? 0,
    totalTokensOut: s._sum.tokensOut ?? 0,
    sessionCount: s._count,
  }));

  return {
    data: breakdown,
    totalCost: breakdown.reduce((sum, b) => sum + b.totalCost, 0),
  };
}

export async function getEmployeeCostSummary(employeeId: string) {
  // Get the user associated with this employee
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { userId: true, firstName: true, lastName: true },
  });
  if (!employee) throw { statusCode: 404, error: 'Not Found', message: 'Employee not found' };

  // Get all agents created by this user
  const agents = await prisma.agentRegistry.findMany({
    where: { createdBy: employee.userId },
    select: { id: true, name: true, slug: true, status: true, createdBy: true },
  });

  const agentIds = agents.map((a) => a.id);

  // Aggregate sessions for all these agents
  const sessions = agentIds.length > 0
    ? await prisma.traceSession.groupBy({
        by: ['agentId'],
        where: { agentId: { in: agentIds } },
        _sum: { cost: true },
        _count: true,
      })
    : [];

  // Count errors
  const errorCounts = agentIds.length > 0
    ? await prisma.traceSession.groupBy({
        by: ['agentId'],
        where: { agentId: { in: agentIds }, status: 'error' },
        _count: true,
      })
    : [];

  const sessionMap = new Map(sessions.map((s) => [s.agentId, s]));
  const errorMap = new Map(errorCounts.map((e) => [e.agentId, e._count]));

  const agentSummaries = agents.map((a) => {
    const s = sessionMap.get(a.id);
    const totalSessions = s?._count ?? 0;
    const errors = errorMap.get(a.id) ?? 0;
    return {
      ...a,
      totalCost: Number(s?._sum.cost ?? 0),
      sessionCount: totalSessions,
      errorRate: totalSessions > 0 ? errors / totalSessions : 0,
    };
  });

  return {
    data: {
      employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      agents: agentSummaries,
      totalCost: agentSummaries.reduce((sum, a) => sum + a.totalCost, 0),
      totalAgents: agents.length,
    },
  };
}

export async function getOrgCostRollup() {
  // Get all employees with their managers and department info
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      managerId: true,
      userId: true,
      department: { select: { id: true, name: true } },
    },
  });

  // Get all agents with their creator info
  const agents = await prisma.agentRegistry.findMany({
    select: { id: true, name: true, status: true, createdBy: true },
  });

  // Get all session costs grouped by agent
  const sessionCosts = await prisma.traceSession.groupBy({
    by: ['agentId'],
    _sum: { cost: true },
    _count: true,
  });
  const costMap = new Map(sessionCosts.map((s) => [s.agentId, { cost: Number(s._sum.cost ?? 0), sessions: s._count }]));

  // Build employee → agents map
  const userIdToEmpId = new Map(employees.map((e) => [e.userId, e.id]));
  const empAgents = new Map<string, any[]>();
  for (const a of agents) {
    const empId = userIdToEmpId.get(a.createdBy);
    if (empId) {
      if (!empAgents.has(empId)) empAgents.set(empId, []);
      const c = costMap.get(a.id);
      empAgents.get(empId)!.push({
        id: a.id,
        name: a.name,
        status: a.status,
        totalCost: c?.cost ?? 0,
        sessionCount: c?.sessions ?? 0,
      });
    }
  }

  // Build tree nodes
  const nodes = employees.map((e) => {
    const ags = empAgents.get(e.id) ?? [];
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`,
      managerId: e.managerId,
      department: e.department,
      agents: ags,
      totalCost: ags.reduce((sum: number, a: any) => sum + a.totalCost, 0),
      activeAgents: ags.filter((a: any) => a.status === 'ACTIVE').length,
    };
  });

  // Roll up costs to managers
  const nodeMap = new Map(nodes.map((n) => [n.employeeId, { ...n, teamCost: n.totalCost, teamActiveAgents: n.activeAgents }]));
  for (const n of nodes) {
    let current = n;
    let managerId = current.managerId;
    while (managerId && nodeMap.has(managerId)) {
      const manager = nodeMap.get(managerId)!;
      manager.teamCost += n.totalCost;
      manager.teamActiveAgents += n.activeAgents;
      managerId = manager.managerId;
    }
  }

  return { data: Array.from(nodeMap.values()) };
}

export async function costByDay(agentId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const events = await prisma.sessionEvent.findMany({
    where: {
      session: { agentId },
      timestamp: { gte: since },
    },
    select: { cost: true, timestamp: true },
  });

  // Group by date
  const dailyCosts = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCosts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of events) {
    const day = e.timestamp.toISOString().slice(0, 10);
    dailyCosts.set(day, (dailyCosts.get(day) ?? 0) + Number(e.cost));
  }

  return {
    data: Array.from(dailyCosts.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
