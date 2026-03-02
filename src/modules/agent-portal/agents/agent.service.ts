import prisma from '../../../lib/prisma.js';
import { encrypt, decrypt } from '../../../lib/encryption.js';
import type { CreateAgentInput, UpdateAgentInput, ListAgentsQuery } from './agent.schemas.js';
import type { Prisma } from '@prisma/client';

export async function registerAgent(data: CreateAgentInput, userId: string) {
  const agent = await prisma.agentRegistry.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      type: data.type,
      model: data.model,
      systemPrompt: data.systemPrompt ? encrypt(data.systemPrompt) : undefined,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      timeoutMs: data.timeoutMs,
      capabilities: data.capabilities
        ? (data.capabilities as unknown as Prisma.InputJsonValue)
        : undefined,
      tools: data.tools ? (data.tools as unknown as Prisma.InputJsonValue) : undefined,
      isCritical: data.isCritical,
      status: 'ACTIVE',
      createdBy: userId,
    },
  });
  return agent;
}

export async function updateAgent(id: string, data: UpdateAgentInput, userId: string) {
  const existing = await prisma.agentRegistry.findUnique({ where: { id } });
  if (!existing) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const updateData: Prisma.AgentRegistryUpdateInput = { updater: { connect: { id: userId } } };
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (data.name !== undefined) {
    changes.name = { old: existing.name, new: data.name };
    updateData.name = data.name;
  }
  if (data.slug !== undefined) {
    changes.slug = { old: existing.slug, new: data.slug };
    updateData.slug = data.slug;
  }
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type !== undefined) {
    changes.type = { old: existing.type, new: data.type };
    updateData.type = data.type;
  }
  if (data.model !== undefined) {
    changes.model = { old: existing.model, new: data.model };
    updateData.model = data.model;
  }
  if (data.systemPrompt !== undefined) {
    updateData.systemPrompt = data.systemPrompt ? encrypt(data.systemPrompt) : null;
    updateData.systemPromptVersion = { increment: 1 };
    changes.systemPrompt = { old: '[encrypted]', new: '[encrypted]' };
  }
  if (data.temperature !== undefined) {
    changes.temperature = { old: existing.temperature, new: data.temperature };
    updateData.temperature = data.temperature;
  }
  if (data.maxTokens !== undefined) {
    changes.maxTokens = { old: existing.maxTokens, new: data.maxTokens };
    updateData.maxTokens = data.maxTokens;
  }
  if (data.timeoutMs !== undefined) {
    changes.timeoutMs = { old: existing.timeoutMs, new: data.timeoutMs };
    updateData.timeoutMs = data.timeoutMs;
  }
  if (data.capabilities !== undefined)
    updateData.capabilities = data.capabilities as unknown as Prisma.InputJsonValue;
  if (data.tools !== undefined) updateData.tools = data.tools as unknown as Prisma.InputJsonValue;
  if (data.isCritical !== undefined) updateData.isCritical = data.isCritical;

  const agent = await prisma.agentRegistry.update({ where: { id }, data: updateData });

  if (Object.keys(changes).length > 0) {
    await prisma.agentConfigLog.create({
      data: {
        agentId: id,
        changedBy: userId,
        changeType: 'UPDATE',
        previousValue: Object.fromEntries(
          Object.entries(changes).map(([k, v]) => [k, String(v.old)]),
        ) as unknown as Prisma.InputJsonValue,
        newValue: Object.fromEntries(
          Object.entries(changes).map(([k, v]) => [k, String(v.new)]),
        ) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return agent;
}

export async function deactivateAgent(id: string, userId: string) {
  const existing = await prisma.agentRegistry.findUnique({ where: { id } });
  if (!existing) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const agent = await prisma.agentRegistry.update({
    where: { id },
    data: { status: 'INACTIVE', updater: { connect: { id: userId } } },
  });

  await prisma.agentConfigLog.create({
    data: {
      agentId: id,
      changedBy: userId,
      changeType: 'DEACTIVATE',
      previousValue: { status: existing.status } as unknown as Prisma.InputJsonValue,
      newValue: { status: 'INACTIVE' } as unknown as Prisma.InputJsonValue,
    },
  });

  return agent;
}

export async function archiveAgent(id: string, userId: string) {
  const existing = await prisma.agentRegistry.findUnique({ where: { id } });
  if (!existing) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const agent = await prisma.agentRegistry.update({
    where: { id },
    data: { status: 'ARCHIVED', updater: { connect: { id: userId } } },
  });

  await prisma.agentConfigLog.create({
    data: {
      agentId: id,
      changedBy: userId,
      changeType: 'ARCHIVE',
      previousValue: { status: existing.status } as unknown as Prisma.InputJsonValue,
      newValue: { status: 'ARCHIVED' } as unknown as Prisma.InputJsonValue,
    },
  });

  return agent;
}

export async function getAgents(query: ListAgentsQuery) {
  const { page, limit, search, type, status, teamId } = query;
  const where: Prisma.AgentRegistryWhereInput = {};

  if (type) where.type = type;
  if (status) where.status = status;
  if (teamId) where.teamId = teamId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.agentRegistry.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        team: { select: { id: true, name: true } },
        parentAgent: { select: { id: true, name: true, slug: true } },
        childAgents: { select: { id: true, name: true, slug: true, model: true, description: true, status: true } },
      },
    }),
    prisma.agentRegistry.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getAgentHierarchy() {
  const agents = await prisma.agentRegistry.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    include: {
      parentAgent: { select: { id: true, name: true } },
      childAgents: {
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, model: true, description: true, status: true, type: true },
      },
      team: { select: { id: true, name: true } },
      creator: { select: { id: true, email: true } },
    },
  });

  // Build tree: root agents (no parent) with nested children
  const roots = agents.filter(a => !a.parentAgentId);
  return roots.map(root => ({
    ...root,
    role: 'master',
    children: root.childAgents.map(child => ({
      ...child,
      role: 'sub-agent',
    })),
  }));
}

export async function getAgentById(idOrSlug: string) {
  // Try lookup by ID first
  let agent = await prisma.agentRegistry.findUnique({
    where: { id: idOrSlug },
    include: {
      team: { select: { id: true, name: true } },
      parentAgent: { select: { id: true, name: true, slug: true } },
      childAgents: {
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, model: true, description: true, status: true },
      },
      dailyStats: {
        orderBy: { date: 'desc' },
        take: 7,
      },
    },
  });

  // If not found by ID, try lookup by slug
  if (!agent) {
    agent = await prisma.agentRegistry.findFirst({
      where: { slug: idOrSlug },
      include: {
        team: { select: { id: true, name: true } },
        parentAgent: { select: { id: true, name: true, slug: true } },
        childAgents: {
          where: { status: 'ACTIVE' },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, slug: true, model: true, description: true, status: true },
        },
        dailyStats: {
          orderBy: { date: 'desc' },
          take: 7,
        },
      },
    });
  }

  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };
  return agent;
}

export async function getAgentDetail(idOrSlug: string) {
  // Try lookup by ID first
  let agent = await prisma.agentRegistry.findUnique({
    where: { id: idOrSlug },
    include: {
      team: { select: { id: true, name: true } },
      configLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { changer: { select: { id: true, email: true } } },
      },
    },
  });

  // If not found by ID, try lookup by slug
  if (!agent) {
    agent = await prisma.agentRegistry.findFirst({
      where: { slug: idOrSlug },
      include: {
        team: { select: { id: true, name: true } },
        configLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { changer: { select: { id: true, email: true } } },
        },
      },
    });
  }

  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  return {
    ...agent,
    systemPrompt: agent.systemPrompt ? decrypt(agent.systemPrompt) : null,
  };
}

export async function healthCheck(id: string) {
  const existing = await prisma.agentRegistry.findUnique({ where: { id } });
  if (!existing) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const agent = await prisma.agentRegistry.update({
    where: { id },
    data: {
      lastHealthCheck: new Date(),
      lastHealthStatus: 'healthy',
    },
  });

  return { id: agent.id, status: 'healthy', checkedAt: agent.lastHealthCheck };
}
