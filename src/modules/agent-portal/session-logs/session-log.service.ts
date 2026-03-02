import prisma from '../../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

interface SessionLogQuery {
  page: number;
  limit: number;
  agentId?: string;
  teamId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  costMin?: number;
  costMax?: number;
}

export async function getSessionLogs(query: SessionLogQuery) {
  const { page, limit, agentId: agentIdOrSlug, teamId, dateFrom, dateTo, status, costMin, costMax } = query;
  const where: Prisma.AgentSessionWhereInput = {};

  // If agentId provided, try to resolve it (could be ID or slug)
  if (agentIdOrSlug) {
    // Try to find agent by ID first
    let agent = await prisma.agentRegistry.findUnique({
      where: { id: agentIdOrSlug },
      select: { id: true },
    });

    // If not found by ID, try by slug
    if (!agent) {
      agent = await prisma.agentRegistry.findFirst({
        where: { slug: agentIdOrSlug },
        select: { id: true },
      });
    }

    // If agent found, use its ID; otherwise use the original value
    if (agent) {
      where.agentId = agent.id;
    } else {
      where.agentId = agentIdOrSlug; // Use original value (will return no results if invalid)
    }
  }
  if (status) where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  if (costMin !== undefined || costMax !== undefined) {
    where.cost = {};
    if (costMin !== undefined) where.cost.gte = costMin;
    if (costMax !== undefined) where.cost.lte = costMax;
  }
  if (teamId) {
    where.agent = { teamId };
  }

  const [data, total] = await Promise.all([
    prisma.agentSession.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true, model: true } },
        user: { select: { id: true, email: true } },
      },
    }),
    prisma.agentSession.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getSessionDetail(id: string) {
  const session = await prisma.agentSession.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, model: true } },
      user: { select: { id: true, email: true } },
      costLedger: true,
    },
  });
  if (!session) throw { statusCode: 404, error: 'Not Found', message: 'Session not found' };
  return session;
}
