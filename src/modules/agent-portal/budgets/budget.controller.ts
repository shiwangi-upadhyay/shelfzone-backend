import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAudit } from '../../../lib/audit.js';
import * as budgetService from './budget.service.js';

const createBudgetSchema = z.object({
  agentId: z.string().cuid().optional(),
  teamId: z.string().cuid().optional(),
  monthlyCapUsd: z.number().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2100),
});

const listBudgetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  agentId: z.string().cuid().optional(),
  teamId: z.string().cuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().optional(),
});

const agentIdParamsSchema = z.object({ agentId: z.string().cuid() });
const idParamsSchema = z.object({ id: z.string().cuid() });

export async function setBudgetHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createBudgetSchema.safeParse(request.body);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });

  try {
    const budget = await budgetService.setBudget(parsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'SET_BUDGET',
      resource: 'AgentBudget',
      resourceId: budget.id,
      details: parsed.data,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: budget });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listBudgetsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listBudgetQuerySchema.safeParse(request.query);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  const result = await budgetService.getBudgets(parsed.data);
  return reply.send(result);
}

export async function checkBudgetHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentIdParamsSchema.safeParse(request.params);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  const data = await budgetService.checkBudget(parsed.data.agentId);
  return reply.send({ data });
}

export async function unpauseHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamsSchema.safeParse(request.params);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });

  // Need to find the budget to get agentId
  try {
    const budget = await (
      await import('../../../lib/prisma.js')
    ).default.agentBudget.findUnique({ where: { id: parsed.data.id } });
    if (!budget) return reply.status(404).send({ error: 'Not Found', message: 'Budget not found' });
    if (!budget.agentId)
      return reply.status(400).send({ error: 'Bad Request', message: 'Budget has no agent' });

    const result = await budgetService.unpause(budget.agentId, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'UNPAUSE_AGENT',
      resource: 'AgentBudget',
      resourceId: parsed.data.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
