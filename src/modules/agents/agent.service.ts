import { type Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import type { CreateAgentInput, UpdateAgentInput, ListAgentsQuery } from './agent.schemas.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createAgent(data: CreateAgentInput, userId: string) {
  const existing = await prisma.agentRegistry.findUnique({ where: { name: data.name } });
  if (existing) {
    throw { statusCode: 409, error: 'Conflict', message: 'Agent name already exists' };
  }

  const { systemPrompt, tools, metadata, ...rest } = data;
  return prisma.agentRegistry.create({
    data: {
      ...rest,
      slug: slugify(data.name),
      systemPrompt: systemPrompt ? encrypt(systemPrompt) : null,
      tools: tools as Prisma.InputJsonValue | undefined,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      createdBy: userId,
    },
    select: agentSelect,
  });
}

export async function getAgents(query: ListAgentsQuery) {
  const { page, limit, search, type, status } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (type) where.type = type;
  if (status) where.status = status;

  const [data, total] = await Promise.all([
    prisma.agentRegistry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: agentSelect,
    }),
    prisma.agentRegistry.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAgentById(id: string) {
  const agent = await prisma.agentRegistry.findUnique({
    where: { id },
    select: { ...agentSelect, systemPrompt: true },
  });

  if (!agent) {
    throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };
  }

  return {
    ...agent,
    systemPrompt: agent.systemPrompt ? decrypt(agent.systemPrompt) : null,
  };
}

export async function updateAgent(id: string, data: UpdateAgentInput, userId: string) {
  const agent = await prisma.agentRegistry.findUnique({ where: { id } });
  if (!agent) {
    throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };
  }

  if (data.name && data.name !== agent.name) {
    const existing = await prisma.agentRegistry.findUnique({ where: { name: data.name } });
    if (existing) {
      throw { statusCode: 409, error: 'Conflict', message: 'Agent name already exists' };
    }
  }

  const { systemPrompt, tools, metadata, ...rest } = data;
  const updateData: Record<string, unknown> = {
    ...rest,
    updatedBy: userId,
    ...(data.name && { slug: slugify(data.name) }),
    ...(tools !== undefined && { tools: tools as Prisma.InputJsonValue }),
    ...(metadata !== undefined && { metadata: metadata as Prisma.InputJsonValue }),
  };

  if (systemPrompt !== undefined) {
    updateData.systemPrompt = systemPrompt ? encrypt(systemPrompt) : null;
  }

  return prisma.agentRegistry.update({
    where: { id },
    data: updateData,
    select: agentSelect,
  });
}

export async function deleteAgent(id: string) {
  const agent = await prisma.agentRegistry.findUnique({ where: { id } });
  if (!agent) {
    throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };
  }

  return prisma.agentRegistry.update({
    where: { id },
    data: { status: 'ARCHIVED' },
    select: agentSelect,
  });
}

const agentSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  type: true,
  status: true,
  model: true,
  temperature: true,
  maxTokens: true,
  tools: true,
  metadata: true,
  isCritical: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: { id: true, email: true } },
  updater: { select: { id: true, email: true } },
};
