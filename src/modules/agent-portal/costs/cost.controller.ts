import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as costService from './cost.service.js';

const idParamsSchema = z.object({ id: z.string().cuid() });
const periodQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d+d$/)
    .default('7d'),
});
const breakdownQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d+d$/)
    .default('7d'),
  groupBy: z.enum(['agent', 'team', 'model', 'day']).default('agent'),
});

export async function getAgentCostsHandler(request: FastifyRequest, reply: FastifyReply) {
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

  const data = await costService.getAgentCosts(params.data.id, query.data.period);
  return reply.send({ data });
}

export async function getTeamCostsHandler(request: FastifyRequest, reply: FastifyReply) {
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

  const data = await costService.getTeamCosts(params.data.id, query.data.period);
  return reply.send({ data });
}

export async function getPlatformCostsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = periodQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  const data = await costService.getPlatformCosts(query.data.period);
  return reply.send({ data });
}

export async function getCostBreakdownHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = breakdownQuerySchema.safeParse(request.query);
  if (!query.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: query.error.issues[0].message });

  const data = await costService.getCostBreakdown(query.data.period, query.data.groupBy);
  return reply.send({ data });
}
