import prisma from '../../../lib/prisma.js';
import type { CreateTeamInput, UpdateTeamInput } from './team.schemas.js';

export async function createTeam(data: CreateTeamInput, userId: string) {
  return prisma.agentTeam.create({
    data: {
      name: data.name,
      description: data.description,
      leadAgentId: data.leadAgentId,
      createdBy: userId,
    },
  });
}

export async function updateTeam(id: string, data: UpdateTeamInput) {
  const existing = await prisma.agentTeam.findUnique({ where: { id } });
  if (!existing) throw { statusCode: 404, error: 'Not Found', message: 'Team not found' };

  return prisma.agentTeam.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      leadAgentId: data.leadAgentId,
      isActive: data.isActive,
    },
  });
}

export async function getTeams(query: { page: number; limit: number }) {
  const { page, limit } = query;
  const [data, total] = await Promise.all([
    prisma.agentTeam.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { agents: true } } },
    }),
    prisma.agentTeam.count(),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getTeamById(id: string) {
  const team = await prisma.agentTeam.findUnique({
    where: { id },
    include: {
      agents: {
        select: { id: true, name: true, slug: true, type: true, status: true, model: true },
      },
      leadAgent: { select: { id: true, name: true } },
    },
  });
  if (!team) throw { statusCode: 404, error: 'Not Found', message: 'Team not found' };
  return team;
}

export async function assignAgent(teamId: string, agentId: string) {
  const team = await prisma.agentTeam.findUnique({ where: { id: teamId } });
  if (!team) throw { statusCode: 404, error: 'Not Found', message: 'Team not found' };

  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  return prisma.agentRegistry.update({
    where: { id: agentId },
    data: { teamId },
  });
}

export async function removeAgent(teamId: string, agentId: string) {
  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };
  if (agent.teamId !== teamId) {
    throw { statusCode: 400, error: 'Bad Request', message: 'Agent is not in this team' };
  }

  return prisma.agentRegistry.update({
    where: { id: agentId },
    data: { teamId: null },
  });
}

export async function getTeamAggregation(teamId: string) {
  const team = await prisma.agentTeam.findUnique({
    where: { id: teamId },
    include: { agents: { select: { id: true } } },
  });
  if (!team) throw { statusCode: 404, error: 'Not Found', message: 'Team not found' };

  const agentIds = team.agents.map((a) => a.id);
  if (agentIds.length === 0) {
    return {
      totalSessions: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      successCount: 0,
      errorCount: 0,
    };
  }

  const stats = await prisma.agentDailyStats.aggregate({
    where: { agentId: { in: agentIds } },
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
    totalSessions: stats._sum.totalSessions ?? 0,
    successCount: stats._sum.successCount ?? 0,
    errorCount: stats._sum.errorCount ?? 0,
    totalInputTokens: stats._sum.totalInputTokens ?? 0,
    totalOutputTokens: stats._sum.totalOutputTokens ?? 0,
    totalCost: stats._sum.totalCost ?? 0,
  };
}
