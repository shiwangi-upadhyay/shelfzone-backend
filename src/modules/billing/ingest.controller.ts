import { FastifyRequest, FastifyReply } from 'fastify';
import { ingestSessionSchema } from './ingest.schemas.js';
import { ingestSession } from './ingest.service.js';

export async function ingestHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = ingestSessionSchema.parse(request.body);
  const userId = (request as any).user.userId;

  const result = await ingestSession(userId, body);

  return reply.status(201).send({ data: result });
}
