import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../../lib/audit.js';
import {
  createTeamSchema,
  updateTeamSchema,
  teamParamsSchema,
  assignAgentSchema,
  removeAgentParamsSchema,
  listTeamsQuerySchema,
} from './team.schemas.js';
import * as teamService from './team.service.js';

export async function createTeamHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createTeamSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }
  try {
    const team = await teamService.createTeam(parsed.data, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'AgentTeam',
      resourceId: team.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: team });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function updateTeamHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = teamParamsSchema.safeParse(request.params);
  if (!paramsParsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: paramsParsed.error.issues[0].message });
  const bodyParsed = updateTeamSchema.safeParse(request.body);
  if (!bodyParsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: bodyParsed.error.issues[0].message });

  try {
    const team = await teamService.updateTeam(paramsParsed.data.id, bodyParsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'AgentTeam',
      resourceId: paramsParsed.data.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: team });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listTeamsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listTeamsQuerySchema.safeParse(request.query);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  const result = await teamService.getTeams(parsed.data);
  return reply.send(result);
}

export async function getTeamHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = teamParamsSchema.safeParse(request.params);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  try {
    const team = await teamService.getTeamById(parsed.data.id);
    return reply.send({ data: team });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function assignAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = teamParamsSchema.safeParse(request.params);
  if (!paramsParsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: paramsParsed.error.issues[0].message });
  const bodyParsed = assignAgentSchema.safeParse(request.body);
  if (!bodyParsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: bodyParsed.error.issues[0].message });

  try {
    const agent = await teamService.assignAgent(paramsParsed.data.id, bodyParsed.data.agentId);
    logAudit({
      userId: request.user!.userId,
      action: 'ASSIGN_AGENT',
      resource: 'AgentTeam',
      resourceId: paramsParsed.data.id,
      details: { agentId: bodyParsed.data.agentId },
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

export async function removeAgentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = removeAgentParamsSchema.safeParse(request.params);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });

  try {
    const agent = await teamService.removeAgent(parsed.data.id, parsed.data.agentId);
    logAudit({
      userId: request.user!.userId,
      action: 'REMOVE_AGENT',
      resource: 'AgentTeam',
      resourceId: parsed.data.id,
      details: { agentId: parsed.data.agentId },
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

export async function getTeamStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = teamParamsSchema.safeParse(request.params);
  if (!parsed.success)
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  try {
    const stats = await teamService.getTeamAggregation(parsed.data.id);
    return reply.send({ data: stats });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
