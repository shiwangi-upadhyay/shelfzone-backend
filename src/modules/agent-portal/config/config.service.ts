import prisma from '../../../lib/prisma.js';
import { encrypt } from '../../../lib/encryption.js';
import type { Prisma } from '@prisma/client';

export async function changeModel(
  agentId: string,
  newModel: string,
  userId: string,
  reason?: string,
) {
  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const updated = await prisma.agentRegistry.update({
    where: { id: agentId },
    data: { model: newModel, updater: { connect: { id: userId } } },
  });

  await prisma.agentConfigLog.create({
    data: {
      agentId,
      changedBy: userId,
      changeType: 'MODEL_CHANGE',
      previousValue: { model: agent.model } as unknown as Prisma.InputJsonValue,
      newValue: { model: newModel } as unknown as Prisma.InputJsonValue,
      reason,
    },
  });

  return updated;
}

export async function updateSystemPrompt(
  agentId: string,
  newPrompt: string,
  userId: string,
  reason?: string,
) {
  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const updated = await prisma.agentRegistry.update({
    where: { id: agentId },
    data: {
      systemPrompt: encrypt(newPrompt),
      systemPromptVersion: { increment: 1 },
      updater: { connect: { id: userId } },
    },
  });

  await prisma.agentConfigLog.create({
    data: {
      agentId,
      changedBy: userId,
      changeType: 'PROMPT_UPDATE',
      previousValue: { version: agent.systemPromptVersion } as unknown as Prisma.InputJsonValue,
      newValue: { version: updated.systemPromptVersion } as unknown as Prisma.InputJsonValue,
      reason,
    },
  });

  return updated;
}

export async function adjustParams(
  agentId: string,
  params: { temperature?: number; maxTokens?: number; timeoutMs?: number },
  userId: string,
  reason?: string,
) {
  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const previousValue: Record<string, number> = {};
  const newValue: Record<string, number> = {};
  const data: Record<string, number> = {};

  if (params.temperature !== undefined) {
    previousValue.temperature = agent.temperature;
    newValue.temperature = params.temperature;
    data.temperature = params.temperature;
  }
  if (params.maxTokens !== undefined) {
    previousValue.maxTokens = agent.maxTokens;
    newValue.maxTokens = params.maxTokens;
    data.maxTokens = params.maxTokens;
  }
  if (params.timeoutMs !== undefined) {
    previousValue.timeoutMs = agent.timeoutMs;
    newValue.timeoutMs = params.timeoutMs;
    data.timeoutMs = params.timeoutMs;
  }

  const updated = await prisma.agentRegistry.update({
    where: { id: agentId },
    data: { ...data, updater: { connect: { id: userId } } },
  });

  await prisma.agentConfigLog.create({
    data: {
      agentId,
      changedBy: userId,
      changeType: 'PARAMS_ADJUST',
      previousValue: previousValue as unknown as Prisma.InputJsonValue,
      newValue: newValue as unknown as Prisma.InputJsonValue,
      reason,
    },
  });

  return updated;
}

export async function toggleAgent(
  agentId: string,
  enable: boolean,
  userId: string,
  reason?: string,
) {
  const agent = await prisma.agentRegistry.findUnique({ where: { id: agentId } });
  if (!agent) throw { statusCode: 404, error: 'Not Found', message: 'Agent not found' };

  const newStatus = enable ? 'ACTIVE' : 'INACTIVE';
  const updated = await prisma.agentRegistry.update({
    where: { id: agentId },
    data: { status: newStatus as 'ACTIVE' | 'INACTIVE', updater: { connect: { id: userId } } },
  });

  await prisma.agentConfigLog.create({
    data: {
      agentId,
      changedBy: userId,
      changeType: 'TOGGLE',
      previousValue: { status: agent.status } as unknown as Prisma.InputJsonValue,
      newValue: { status: newStatus } as unknown as Prisma.InputJsonValue,
      reason,
    },
  });

  return updated;
}

export async function getConfigHistory(agentId: string, limit = 50) {
  return prisma.agentConfigLog.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { changer: { select: { id: true, email: true } } },
  });
}
