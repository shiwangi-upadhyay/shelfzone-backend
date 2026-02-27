import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as analyticsService from './analytics.service.js';

const idParamsSchema = z.object({ id: z.string().cuid() });
const periodQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d+d$/)
    .default('7d'),
});
const trendParamsSchema = z.object({ agentId: z.string().cuid() });
const trendQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export async function getAgentAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = idParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const query = periodQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  try {
    const data = await analyticsService.getAgentAnalytics(params.data.id, query.data.period);
    return reply.send({ data });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function getTeamAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = idParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const query = periodQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  const data = await analyticsService.getTeamAnalytics(params.data.id, query.data.period);
  return reply.send({ data });
}

export async function getPlatformAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = periodQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  const data = await analyticsService.getPlatformAnalytics(query.data.period);
  return reply.send({ data });
}

export async function getTokenTrendsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = trendParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const query = trendQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  const data = await analyticsService.getTokenTrends(params.data.agentId, query.data.days);
  return reply.send({ data });
}

export async function getAgentEfficiencyHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = trendParamsSchema.safeParse(request.params);
  if (!params.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  const query = periodQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  try {
    const data = await analyticsService.getAgentEfficiency(params.data.agentId, query.data.period);
    return reply.send({ data });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
