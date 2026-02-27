import prisma from '../../../lib/prisma.js';
import type { Prisma } from '@prisma/client';

interface LogCommandData {
  userId: string;
  command: string;
  classification: string;
  agentsInvoked?: unknown;
  outcome: string;
  totalCost?: number;
  totalLatencyMs?: number;
  metadata?: Record<string, unknown>;
}

interface CommandQuery {
  page: number;
  limit: number;
  userId?: string;
  classification?: string;
  dateFrom?: string;
  dateTo?: string;
  outcome?: string;
}

export function logCommand(data: LogCommandData): void {
  // Fire-and-forget
  void prisma.commandLog
    .create({
      data: {
        userId: data.userId,
        command: data.command,
        classification: data.classification,
        agentsInvoked: (data.agentsInvoked as Prisma.InputJsonValue) ?? undefined,
        outcome: data.outcome,
        totalCost: data.totalCost ?? 0,
        totalLatencyMs: data.totalLatencyMs ?? 0,
        metadata: (data.metadata as unknown as Prisma.InputJsonValue) ?? undefined,
      },
    })
    .catch(() => {});
}

export async function getCommands(query: CommandQuery) {
  const { page, limit, userId, classification, dateFrom, dateTo, outcome } = query;
  const where: Prisma.CommandLogWhereInput = {};

  if (userId) where.userId = userId;
  if (classification) where.classification = classification;
  if (outcome) where.outcome = outcome;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [data, total] = await Promise.all([
    prisma.commandLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true } } },
    }),
    prisma.commandLog.count({ where }),
  ]);

  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getCommandDetail(id: string) {
  const command = await prisma.commandLog.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!command) throw { statusCode: 404, error: 'Not Found', message: 'Command not found' };
  return command;
}
