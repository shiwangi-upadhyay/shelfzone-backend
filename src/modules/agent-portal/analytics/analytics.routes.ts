import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import {
  getAgentAnalyticsHandler,
  getTeamAnalyticsHandler,
  getPlatformAnalyticsHandler,
  getTokenTrendsHandler,
  getAgentEfficiencyHandler,
} from './analytics.controller.js';

export default async function analyticsRoutes(app: FastifyInstance) {
  app.get(
    '/api/agent-portal/analytics/agent/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getAgentAnalyticsHandler,
  );

  app.get(
    '/api/agent-portal/analytics/team/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getTeamAnalyticsHandler,
  );

  app.get(
    '/api/agent-portal/analytics/platform',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getPlatformAnalyticsHandler,
  );

  app.get(
    '/api/agent-portal/analytics/trends/:agentId',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getTokenTrendsHandler,
  );

  app.get(
    '/api/agent-portal/analytics/efficiency/:agentId',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getAgentEfficiencyHandler,
  );
}
