import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../../lib/audit.js';
import {
  createAgentSchema,
  updateAgentSchema,
  agentParamsSchema,
  listAgentsQuerySchema,
} from './agent.schemas.js';
import * as agentService from './agent.service.js';

export async function registerAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createAgentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const agent = await agentService.registerAgent(parsed.data, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'AgentRegistry',
      resourceId: agent.id,
      details: { name: agent.name, slug: agent.slug },
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
      resource: 'AgentRegistry',
      resourceId: paramsParsed.data.id,
      details: Object.keys(bodyParsed.data),
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

export async function deactivateAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const agent = await agentService.deactivateAgent(parsed.data.id, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'DEACTIVATE',
      resource: 'AgentRegistry',
      resourceId: parsed.data.id,
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

export async function archiveAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const agent = await agentService.archiveAgent(parsed.data.id, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'ARCHIVE',
      resource: 'AgentRegistry',
      resourceId: parsed.data.id,
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

export async function getAgentHierarchyHandler(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const hierarchy = await agentService.getAgentHierarchy();
    return reply.send({ data: hierarchy });
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

export async function getAgentDetailHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const agent = await agentService.getAgentDetail(parsed.data.id);
    return reply.send({ data: agent });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function healthCheckHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = agentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await agentService.healthCheck(parsed.data.id);
    logAudit({
      userId: request.user!.userId,
      action: 'HEALTH_CHECK',
      resource: 'AgentRegistry',
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
