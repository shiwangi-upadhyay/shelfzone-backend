import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logAudit } from '../../../lib/audit.js';
import * as configService from './config.service.js';

const agentIdParamsSchema = z.object({ agentId: z.string().cuid() });
const modelSchema = z.object({ model: z.string().min(1).max(100), reason: z.string().optional() });
const promptSchema = z.object({
  systemPrompt: z.string().min(1).max(50000),
  reason: z.string().optional(),
});
const paramsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200000).optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
  reason: z.string().optional(),
});
const toggleSchema = z.object({ enable: z.boolean(), reason: z.string().optional() });
const historyQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });

export async function changeModelHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = agentIdParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const body = modelSchema.safeParse(request.body);
  if (!body.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: body.error.issues[0].message });

  try {
    const agent = await configService.changeModel(
      params.data.agentId,
      body.data.model,
      request.user!.userId,
      body.data.reason,
    );
    logAudit({
      userId: request.user!.userId,
      action: 'CHANGE_MODEL',
      resource: 'AgentRegistry',
      resourceId: params.data.agentId,
      details: { model: body.data.model },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: agent });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function updatePromptHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = agentIdParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const body = promptSchema.safeParse(request.body);
  if (!body.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: body.error.issues[0].message });

  try {
    const agent = await configService.updateSystemPrompt(
      params.data.agentId,
      body.data.systemPrompt,
      request.user!.userId,
      body.data.reason,
    );
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE_PROMPT',
      resource: 'AgentRegistry',
      resourceId: params.data.agentId,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: agent });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function adjustParamsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = agentIdParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const body = paramsSchema.safeParse(request.body);
  if (!body.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: body.error.issues[0].message });

  try {
    const { reason, ...adjustParams } = body.data;
    const agent = await configService.adjustParams(
      params.data.agentId,
      adjustParams,
      request.user!.userId,
      reason,
    );
    logAudit({
      userId: request.user!.userId,
      action: 'ADJUST_PARAMS',
      resource: 'AgentRegistry',
      resourceId: params.data.agentId,
      details: adjustParams,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: agent });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function toggleAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = agentIdParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const body = toggleSchema.safeParse(request.body);
  if (!body.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: body.error.issues[0].message });

  try {
    const agent = await configService.toggleAgent(
      params.data.agentId,
      body.data.enable,
      request.user!.userId,
      body.data.reason,
    );
    logAudit({
      userId: request.user!.userId,
      action: 'TOGGLE_AGENT',
      resource: 'AgentRegistry',
      resourceId: params.data.agentId,
      details: { enable: body.data.enable },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: agent });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function getConfigHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = agentIdParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const query = historyQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  const data = await configService.getConfigHistory(params.data.agentId, query.data.limit);
  return reply.send({ data });
}
