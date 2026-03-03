import { type Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import type { CreateAgentInput, UpdateAgentInput, ListAgentsQuery } from './agent.schemas.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

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

interface OpenClawAgent {
  id: string;
  name: string;
  workspace?: string;
  model?: string;
  default?: boolean;
  subagents?: {
    allowAgents?: string[];
  };
}

interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgent[];
    defaults?: {
      model?: { primary?: string };
    };
  };
}

/**
 * Sync agents from OpenClaw configuration file
 * Reads /root/.openclaw/openclaw.json and upserts agents into database
 */
export async function syncAgentsFromOpenClaw(userId: string) {
  const configPath = join(process.env.HOME || '/root', '.openclaw', 'openclaw.json');
  
  let config: OpenClawConfig;
  try {
    const configContent = await readFile(configPath, 'utf-8');
    config = JSON.parse(configContent);
  } catch (err) {
    throw { 
      statusCode: 500, 
      error: 'Config Error', 
      message: `Failed to read OpenClaw config: ${(err as Error).message}` 
    };
  }

  const agentList = config.agents?.list || [];
  if (agentList.length === 0) {
    return { synced: [], message: 'No agents found in OpenClaw config' };
  }

  const defaultModel = config.agents?.defaults?.model?.primary || 'anthropic/claude-sonnet-4-5';
  const syncedAgents = [];

  for (const ocAgent of agentList) {
    const agentData = {
      name: ocAgent.name,
      slug: slugify(ocAgent.name),
      model: ocAgent.model || defaultModel,
      type: ocAgent.default ? 'WORKFLOW' as const : 'CHAT' as const,  // WORKFLOW for orchestrator, CHAT for others
      status: 'ACTIVE' as const,
      description: ocAgent.default 
        ? 'Main orchestrator agent' 
        : `${ocAgent.name} specialist agent`,
      metadata: {
        openclawId: ocAgent.id,
        workspace: ocAgent.workspace,
        syncedFromOpenClaw: true,
        syncedAt: new Date().toISOString(),
        ...(ocAgent.subagents ? { subagents: ocAgent.subagents } : {}),
      } as Prisma.InputJsonValue,
    };

    // Upsert by name (match existing agents)
    const existing = await prisma.agentRegistry.findUnique({
      where: { name: ocAgent.name },
    });

    let agent;
    if (existing) {
      // Update existing agent with OpenClaw data
      agent = await prisma.agentRegistry.update({
        where: { id: existing.id },
        data: {
          ...agentData,
          updatedBy: userId,
        },
        select: agentSelect,
      });
    } else {
      // Create new agent
      agent = await prisma.agentRegistry.create({
        data: {
          ...agentData,
          createdBy: userId,
        },
        select: agentSelect,
      });
    }

    syncedAgents.push({
      ...agent,
      action: existing ? 'updated' : 'created',
    });
  }

  return {
    synced: syncedAgents,
    message: `Successfully synced ${syncedAgents.length} agents from OpenClaw config`,
  };
}

/**
 * Get agents preferring OpenClaw-synced agents
 * Returns agents that have been synced from OpenClaw config first
 */
export async function getAgentsPreferOpenClaw(query: ListAgentsQuery) {
  const result = await getAgents(query);
  
  // Sort to prefer OpenClaw-synced agents (they have metadata.syncedFromOpenClaw)
  result.data.sort((a, b) => {
    const aFromOC = (a.metadata as Record<string, unknown>)?.syncedFromOpenClaw ? 1 : 0;
    const bFromOC = (b.metadata as Record<string, unknown>)?.syncedFromOpenClaw ? 1 : 0;
    return bFromOC - aFromOC; // OpenClaw agents first
  });

  return result;
}
