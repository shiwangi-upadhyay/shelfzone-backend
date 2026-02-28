import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  listTracesHandler,
  getTraceHandler,
  createTraceHandler,
  updateTraceHandler,
  deleteTraceHandler,
  getTraceSessionsHandler,
  getSessionHandler,
  getSessionEventsHandler,
  getAgentSessionsHandler,
  createSessionEventHandler,
  getSessionTimelineHandler,
  getAgentCostBreakdownHandler,
  getEmployeeAgentSummaryHandler,
  getOrgTreeOverviewHandler,
  getTraceFlowHandler,
  getAgentStatsHandler,
  streamTraceEventsHandler,
} from './trace.controller.js';

export default async function traceRoutes(app: FastifyInstance) {
  // ─── Task Traces ─────────────────────────────────────────────────

  app.get('/api/traces', { preHandler: [authenticate] }, listTracesHandler);
  app.get('/api/traces/:id', { preHandler: [authenticate] }, getTraceHandler);
  app.post('/api/traces', { preHandler: [authenticate] }, createTraceHandler);
  app.patch('/api/traces/:id', { preHandler: [authenticate] }, updateTraceHandler);
  app.delete('/api/traces/:id', { preHandler: [authenticate] }, deleteTraceHandler);

  // ─── Trace Sessions ──────────────────────────────────────────────

  app.get('/api/traces/:traceId/sessions', { preHandler: [authenticate] }, getTraceSessionsHandler);
  app.get('/api/sessions/:id', { preHandler: [authenticate] }, getSessionHandler);
  app.get('/api/sessions/:id/events', { preHandler: [authenticate] }, getSessionEventsHandler);
  app.get('/api/agents/:agentId/sessions', { preHandler: [authenticate] }, getAgentSessionsHandler);

  // ─── Session Events ──────────────────────────────────────────────

  app.post('/api/sessions/:id/events', { preHandler: [authenticate] }, createSessionEventHandler);
  app.get('/api/sessions/:id/timeline', { preHandler: [authenticate] }, getSessionTimelineHandler);

  // ─── Aggregation & Analytics ─────────────────────────────────────

  app.get(
    '/api/agents/:id/cost-breakdown',
    { preHandler: [authenticate] },
    getAgentCostBreakdownHandler,
  );

  app.get(
    '/api/employees/:id/agent-summary',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER')] },
    getEmployeeAgentSummaryHandler,
  );

  app.get(
    '/api/org-tree/agent-overview',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getOrgTreeOverviewHandler,
  );

  app.get('/api/traces/:id/flow', { preHandler: [authenticate] }, getTraceFlowHandler);
  app.get('/api/agents/:id/stats', { preHandler: [authenticate] }, getAgentStatsHandler);

  // ─── Real-time SSE ───────────────────────────────────────────────

  app.get('/api/traces/:id/events/stream', { preHandler: [authenticate] }, streamTraceEventsHandler);
}
