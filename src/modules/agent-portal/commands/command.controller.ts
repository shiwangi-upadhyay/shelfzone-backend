import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as commandService from './command.service.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.string().cuid().optional(),
  classification: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  outcome: z.string().optional(),
});

const idParamsSchema = z.object({ id: z.string().cuid() });

export async function listCommandsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listQuerySchema.safeParse(request.query);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  const result = await commandService.getCommands(parsed.data);
  return reply.send(result);
}

export async function getCommandDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamsSchema.safeParse(request.params);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  try {
    const data = await commandService.getCommandDetail(parsed.data.id);
    return reply.send({ data });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
