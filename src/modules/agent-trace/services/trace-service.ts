import prisma from '../../../lib/prisma.js';
import { Prisma } from '@prisma/client';

interface ListTracesParams {
  ownerId: string;
  role: string;
  departmentId?: string;
  page?: number;
  limit?: number;
  status?: string;
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function createTrace(data: { instruction: string; masterAgentId?: string }, ownerId: string) {
  return prisma.taskTrace.create({
    data: {
      instruction: data.instruction,
      masterAgentId: data.masterAgentId ?? null,
      ownerId,
    },
    include: {
      masterAgent: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getTrace(id: string, userId: string, role: string) {
  const trace = await prisma.taskTrace.findUnique({
    where: { id },
    include: {
      masterAgent: { select: { id: true, name: true, slug: true } },
      sessions: {
        include: {
          agent: { select: { id: true, name: true, slug: true } },
          _count: { select: { events: true } },
        },
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (role !== 'SUPER_ADMIN' && trace.ownerId !== userId) {
    throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
  }
  return trace;
}

export async function listTraces(params: ListTracesParams) {
  const { ownerId, role, page = 1, limit = 20, status, agentId, dateFrom, dateTo } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.TaskTraceWhereInput = {};

  if (role !== 'SUPER_ADMIN') {
    where.ownerId = ownerId;
  }
  if (status) where.status = status;
  if (agentId) where.masterAgentId = agentId;
  if (dateFrom || dateTo) {
    where.startedAt = {};
    if (dateFrom) where.startedAt.gte = new Date(dateFrom);
    if (dateTo) where.startedAt.lte = new Date(dateTo);
  }

  const [data, total] = await Promise.all([
    prisma.taskTrace.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        masterAgent: { select: { id: true, name: true } },
      },
    }),
    prisma.taskTrace.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function updateTrace(
  id: string,
  userId: string,
  role: string,
  data: { status?: string; completedAt?: string },
) {
  const trace = await prisma.taskTrace.findUnique({ where: { id } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (role !== 'SUPER_ADMIN' && trace.ownerId !== userId) {
    throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
  }

  return prisma.taskTrace.update({
    where: { id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.completedAt && { completedAt: new Date(data.completedAt) }),
    },
  });
}

export async function deleteTrace(id: string, userId: string, role: string) {
  const trace = await prisma.taskTrace.findUnique({ where: { id } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (role !== 'SUPER_ADMIN' && trace.ownerId !== userId) {
    throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
  }

  // Hard delete (cascade will handle sessions/events)
  await prisma.taskTrace.delete({ where: { id } });
  return { success: true };
}

export async function getTraceSessions(traceId: string, userId: string, role: string) {
  const trace = await prisma.taskTrace.findUnique({ where: { id: traceId } });
  if (!trace) throw { statusCode: 404, error: 'Not Found', message: 'Trace not found' };
  if (role !== 'SUPER_ADMIN' && trace.ownerId !== userId) {
    throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
  }

  const sessions = await prisma.traceSession.findMany({
    where: { taskTraceId: traceId },
    include: {
      agent: { select: { id: true, name: true, slug: true, type: true } },
      _count: { select: { events: true } },
    },
    orderBy: { startedAt: 'asc' },
  });

  // Build tree structure
  const sessionMap = new Map<string, any>();
  const roots: any[] = [];

  for (const s of sessions) {
    sessionMap.set(s.id, { ...s, children: [] });
  }
  for (const s of sessions) {
    const node = sessionMap.get(s.id)!;
    if (s.parentSessionId && sessionMap.has(s.parentSessionId)) {
      sessionMap.get(s.parentSessionId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return { data: roots };
}

export async function getSession(id: string) {
  const session = await prisma.traceSession.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, slug: true, type: true } },
      taskTrace: { select: { id: true, ownerId: true, instruction: true } },
      _count: { select: { events: true } },
    },
  });
  if (!session) throw { statusCode: 404, error: 'Not Found', message: 'Session not found' };
  return session;
}

export async function getSessionEvents(
  sessionId: string,
  params: { type?: string; page?: number; limit?: number },
) {
  const { type, page = 1, limit = 50 } = params;
  const skip = (page - 1) * limit;
  const where: Prisma.SessionEventWhereInput = { sessionId };
  if (type) where.type = type;

  const [data, total] = await Promise.all([
    prisma.sessionEvent.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'asc' },
      include: {
        fromAgent: { select: { id: true, name: true } },
        toAgent: { select: { id: true, name: true } },
      },
    }),
    prisma.sessionEvent.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getAgentSessions(
  agentId: string,
  params: { page?: number; limit?: number },
) {
  const { page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.traceSession.findMany({
      where: { agentId },
      skip,
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        taskTrace: { select: { id: true, instruction: true, status: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.traceSession.count({ where: { agentId } }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function createSessionEvent(
  sessionId: string,
  data: {
    type: string;
    content?: string;
    fromAgentId?: string;
    toAgentId?: string;
    metadata?: any;
    tokenCount?: number;
    cost?: number;
    durationMs?: number;
  },
) {
  const session = await prisma.traceSession.findUnique({ where: { id: sessionId } });
  if (!session) throw { statusCode: 404, error: 'Not Found', message: 'Session not found' };

  const event = await prisma.sessionEvent.create({
    data: {
      sessionId,
      type: data.type,
      content: data.content ?? null,
      fromAgentId: data.fromAgentId ?? null,
      toAgentId: data.toAgentId ?? null,
      metadata: data.metadata ?? {},
      tokenCount: data.tokenCount ?? 0,
      cost: data.cost ?? 0,
      durationMs: data.durationMs ?? null,
    },
  });

  // Update session cost/tokens
  if (data.tokenCount || data.cost) {
    await prisma.traceSession.update({
      where: { id: sessionId },
      data: {
        tokensIn: { increment: data.tokenCount ?? 0 },
        cost: { increment: data.cost ?? 0 },
      },
    });
  }

  return event;
}

export async function getSessionTimeline(sessionId: string) {
  const events = await prisma.sessionEvent.findMany({
    where: { sessionId },
    orderBy: { timestamp: 'asc' },
    include: {
      fromAgent: { select: { id: true, name: true } },
      toAgent: { select: { id: true, name: true } },
    },
  });

  // Group events by type for timeline display
  const groups: Record<string, any[]> = {};
  for (const e of events) {
    if (!groups[e.type]) groups[e.type] = [];
    groups[e.type].push(e);
  }

  return {
    data: {
      events,
      groups,
      totalEvents: events.length,
      totalCost: events.reduce((sum, e) => sum + Number(e.cost), 0),
      totalTokens: events.reduce((sum, e) => sum + e.tokenCount, 0),
      totalDurationMs: events.reduce((sum, e) => sum + (e.durationMs ?? 0), 0),
    },
  };
}
