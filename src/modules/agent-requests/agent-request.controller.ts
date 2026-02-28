import { FastifyRequest, FastifyReply } from 'fastify';
import { createRequestSchema, reviewRequestSchema, listRequestsSchema } from './agent-request.schemas.js';
import * as service from './agent-request.service.js';

export async function createHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createRequestSchema.parse(request.body);
  const userId = (request as any).user.userId;
  const data = await service.createRequest(userId, body.agentId, body.purpose, body.priority);
  return reply.status(201).send({ data });
}

export async function listHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = listRequestsSchema.parse(request.query);
  const data = await service.listRequests({ ...query, page: query.page, limit: query.limit });
  return reply.send({ data });
}

export async function myRequestsHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = listRequestsSchema.parse(request.query);
  const userId = (request as any).user.userId;
  const data = await service.listRequests({ ...query, requesterId: userId, page: query.page, limit: query.limit });
  return reply.send({ data });
}

export async function getHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const data = await service.getRequest(id);
  return reply.send({ data });
}

export async function reviewHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = reviewRequestSchema.parse(request.body);
  const reviewerId = (request as any).user.userId;
  const data = await service.reviewRequest(id, reviewerId, body.status, body.reviewNote);
  return reply.send({ data });
}

export async function cancelHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const userId = (request as any).user.userId;
  const data = await service.cancelRequest(id, userId);
  return reply.send({ data });
}

export async function statsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const data = await service.getStats();
  return reply.send({ data });
}
