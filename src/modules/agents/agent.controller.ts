import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  createAgentSchema,
  updateAgentSchema,
  agentParamsSchema,
  listAgentsQuerySchema,
} from './agent.schemas.js';
import * as agentService from './agent.service.js';

export async function createAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createAgentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const agent = await agentService.createAgent(parsed.data, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'Agent',
      resourceId: agent.id,
      details: { name: agent.name, type: agent.type },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: agent });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listAgentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listAgentsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  const result = await agentService.getAgents(parsed.data);
  return reply.send(result);
}

export async function getAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const agent = await agentService.getAgentById(parsed.data.id);
    return reply.send({ data: agent });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function updateAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = agentParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: paramsParsed.error.issues[0].message });
  }

  const bodyParsed = updateAgentSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: bodyParsed.error.issues[0].message });
  }

  try {
    const agent = await agentService.updateAgent(
      paramsParsed.data.id,
      bodyParsed.data,
      request.user!.userId,
    );
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'Agent',
      resourceId: agent.id,
      details: JSON.parse(JSON.stringify(bodyParsed.data)),
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

export async function deleteAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    await agentService.deleteAgent(parsed.data.id);
    logAudit({
      userId: request.user!.userId,
      action: 'DELETE',
      resource: 'Agent',
      resourceId: parsed.data.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: { message: 'Agent archived successfully' } });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
