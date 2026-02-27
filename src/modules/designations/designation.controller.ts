import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  createDesignationSchema,
  updateDesignationSchema,
  getDesignationParamsSchema,
  listDesignationsQuerySchema,
} from './designation.schemas.js';
import * as service from './designation.service.js';

export async function createDesignationHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createDesignationSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation error', message: parsed.error.message });
  }

  const result = await service.createDesignation(parsed.data);
  if ('error' in result) {
    return reply
      .status(409)
      .send({ error: 'Conflict', message: 'Designation with this title already exists' });
  }

  logAudit({
    userId: request.user?.userId,
    action: 'CREATE',
    resource: 'Designation',
    resourceId: result.data.id,
    details: { title: result.data.title },
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  });

  return reply.status(201).send({ data: result.data });
}

export async function listDesignationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listDesignationsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation error', message: parsed.error.message });
  }

  const result = await service.getDesignations(parsed.data);
  return reply.send(result);
}

export async function getDesignationHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getDesignationParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation error', message: parsed.error.message });
  }

  const designation = await service.getDesignationById(parsed.data.id);
  if (!designation) {
    return reply.status(404).send({ error: 'Not found', message: 'Designation not found' });
  }

  return reply.send({ data: designation });
}

export async function updateDesignationHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = getDesignationParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation error', message: paramsParsed.error.message });
  }

  const bodyParsed = updateDesignationSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply.status(400).send({ error: 'Validation error', message: bodyParsed.error.message });
  }

  const result = await service.updateDesignation(paramsParsed.data.id, bodyParsed.data);
  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({ error: 'Not found', message: 'Designation not found' });
    }
    return reply
      .status(409)
      .send({ error: 'Conflict', message: 'Designation with this title already exists' });
  }

  logAudit({
    userId: request.user?.userId,
    action: 'UPDATE',
    resource: 'Designation',
    resourceId: result.data.id,
    details: bodyParsed.data,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  });

  return reply.send({ data: result.data });
}

export async function deleteDesignationHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getDesignationParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Validation error', message: parsed.error.message });
  }

  const result = await service.deleteDesignation(parsed.data.id);
  if ('error' in result) {
    if (result.error === 'NOT_FOUND') {
      return reply.status(404).send({ error: 'Not found', message: 'Designation not found' });
    }
    return reply.status(409).send({
      error: 'Conflict',
      message: 'Cannot deactivate designation with active employees',
    });
  }

  logAudit({
    userId: request.user?.userId,
    action: 'DELETE',
    resource: 'Designation',
    resourceId: result.data.id,
    details: { softDelete: true },
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  });

  return reply.send({ data: result.data });
}
