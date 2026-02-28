import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createTraceSchema,
  updateTraceSchema,
  listTracesQuerySchema,
  idParamSchema,
  traceIdParamSchema,
  agentIdParamSchema,
  sessionEventsQuerySchema,
  paginationQuerySchema,
  createEventSchema,
  employeeIdParamSchema,
  agentStatsQuerySchema,
} from './trace.schemas.js';
import * as traceService from './services/trace-service.js';
import * as costService from './services/cost-service.js';
import * as flowService from './services/flow-service.js';

function parseOrReply(schema: any, data: any, reply: FastifyReply) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    reply.status(400).send({ error: 'Validation Error', message: parsed.error.issues[0].message });
    return null;
  }
  return parsed.data;
}

function handleError(err: unknown, reply: FastifyReply) {
  const e = err as { statusCode?: number; error?: string; message?: string };
  return reply.status(e.statusCode ?? 500).send({ error: e.error ?? 'Internal Error', message: e.message });
}

// ─── Task Traces ─────────────────────────────────────────────────────

export async function listTracesHandler(request: FastifyRequest, reply: FastifyReply) {
  const query = parseOrReply(listTracesQuerySchema, request.query, reply);
  if (!query) return;
  const result = await traceService.listTraces({
    ownerId: request.user!.userId,
    role: request.user!.role,
    ...query,
  });
  return reply.send(result);
}

export async function getTraceHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  try {
    const trace = await traceService.getTrace(params.id, request.user!.userId, request.user!.role);
    return reply.send({ data: trace });
  } catch (err) { return handleError(err, reply); }
}

export async function createTraceHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = parseOrReply(createTraceSchema, request.body, reply);
  if (!body) return;
  try {
    const trace = await traceService.createTrace(body, request.user!.userId);
    return reply.status(201).send({ data: trace });
  } catch (err) { return handleError(err, reply); }
}

export async function updateTraceHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  const body = parseOrReply(updateTraceSchema, request.body, reply);
  if (!body) return;
  try {
    const trace = await traceService.updateTrace(params.id, request.user!.userId, request.user!.role, body);
    return reply.send({ data: trace });
  } catch (err) { return handleError(err, reply); }
}

export async function deleteTraceHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  try {
    await traceService.deleteTrace(params.id, request.user!.userId, request.user!.role);
    return reply.status(204).send();
  } catch (err) { return handleError(err, reply); }
}

// ─── Trace Sessions ──────────────────────────────────────────────────

export async function getTraceSessionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(traceIdParamSchema, request.params, reply);
  if (!params) return;
  try {
    const result = await traceService.getTraceSessions(params.traceId, request.user!.userId, request.user!.role);
    return reply.send(result);
  } catch (err) { return handleError(err, reply); }
}

export async function getSessionHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  try {
    const session = await traceService.getSession(params.id);
    return reply.send({ data: session });
  } catch (err) { return handleError(err, reply); }
}

export async function getSessionEventsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  const query = parseOrReply(sessionEventsQuerySchema, request.query, reply);
  if (!query) return;
  const result = await traceService.getSessionEvents(params.id, query);
  return reply.send(result);
}

export async function getAgentSessionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(agentIdParamSchema, request.params, reply);
  if (!params) return;
  const query = parseOrReply(paginationQuerySchema, request.query, reply);
  if (!query) return;
  const result = await traceService.getAgentSessions(params.agentId, query);
  return reply.send(result);
}

// ─── Session Events ──────────────────────────────────────────────────

export async function createSessionEventHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  const body = parseOrReply(createEventSchema, request.body, reply);
  if (!body) return;
  try {
    const event = await traceService.createSessionEvent(params.id, body);
    return reply.status(201).send({ data: event });
  } catch (err) { return handleError(err, reply); }
}

export async function getSessionTimelineHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  const result = await traceService.getSessionTimeline(params.id);
  return reply.send(result);
}

// ─── Analytics ───────────────────────────────────────────────────────

export async function getAgentCostBreakdownHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  try {
    const result = await costService.getSubAgentBreakdown(params.id);
    return reply.send(result);
  } catch (err) { return handleError(err, reply); }
}

export async function getEmployeeAgentSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(employeeIdParamSchema, request.params, reply);
  if (!params) return;
  try {
    const result = await costService.getEmployeeCostSummary(params.id);
    return reply.send(result);
  } catch (err) { return handleError(err, reply); }
}

export async function getOrgTreeOverviewHandler(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await costService.getOrgCostRollup();
    return reply.send(result);
  } catch (err) { return handleError(err, reply); }
}

export async function getTraceFlowHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  try {
    const result = await flowService.buildFlowGraph(params.id);
    return reply.send(result);
  } catch (err) { return handleError(err, reply); }
}

export async function getAgentStatsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;
  const query = parseOrReply(agentStatsQuerySchema, request.query, reply);
  if (!query) return;

  try {
    const [costData, breakdown, dailyCosts] = await Promise.all([
      costService.calculateAgentCost(params.id),
      costService.getSubAgentBreakdown(params.id),
      costService.costByDay(params.id, query.days),
    ]);

    // Get error rate
    const sessions = await import('../../lib/prisma.js').then((m) => m.default.traceSession);
    const [total, errors] = await Promise.all([
      sessions.count({ where: { agentId: params.id } }),
      sessions.count({ where: { agentId: params.id, status: 'error' } }),
    ]);

    return reply.send({
      data: {
        totalSessions: costData.sessionCount,
        avgCost: costData.sessionCount > 0 ? costData.totalCost / costData.sessionCount : 0,
        errorRate: total > 0 ? errors / total : 0,
        totalTokens: costData.totalTokensIn + costData.totalTokensOut,
        costByDay: dailyCosts.data,
        subAgentBreakdown: breakdown.data,
      },
    });
  } catch (err) { return handleError(err, reply); }
}

// ─── SSE Stream ──────────────────────────────────────────────────────

export async function streamTraceEventsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = parseOrReply(idParamSchema, request.params, reply);
  if (!params) return;

  // Verify access
  try {
    await traceService.getTrace(params.id, request.user!.userId, request.user!.role);
  } catch (err) {
    return handleError(err, reply);
  }

  const origin = request.headers.origin || '*';
  reply
    .header('Content-Type', 'text/event-stream')
    .header('Cache-Control', 'no-cache')
    .header('Connection', 'keep-alive')
    .header('X-Accel-Buffering', 'no')
    .header('Access-Control-Allow-Origin', origin)
    .header('Access-Control-Allow-Credentials', 'true');
  reply.raw.writeHead(200, reply.getHeaders() as any);

  reply.raw.write('data: {"type":"connected"}\n\n');

  // Poll for new events every 2 seconds
  let lastTimestamp = new Date();
  const interval = setInterval(async () => {
    try {
      const prisma = (await import('../../lib/prisma.js')).default;
      const events = await prisma.sessionEvent.findMany({
        where: {
          session: { taskTraceId: params.id },
          timestamp: { gt: lastTimestamp },
        },
        orderBy: { timestamp: 'asc' },
        include: {
          fromAgent: { select: { id: true, name: true } },
          toAgent: { select: { id: true, name: true } },
        },
      });

      for (const event of events) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        lastTimestamp = event.timestamp;
      }
    } catch {
      // Connection may be closed
      clearInterval(interval);
    }
  }, 2000);

  request.raw.on('close', () => {
    clearInterval(interval);
  });
}
