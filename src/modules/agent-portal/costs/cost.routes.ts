import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import {
  getAgentCostsHandler,
  getTeamCostsHandler,
  getPlatformCostsHandler,
  getCostBreakdownHandler,
} from './cost.controller.js';

export default async function costRoutes(app: FastifyInstance) {
  app.get(
    '/api/agent-portal/costs/agent/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getAgentCostsHandler,
  );

  app.get(
    '/api/agent-portal/costs/team/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getTeamCostsHandler,
  );

  app.get(
    '/api/agent-portal/costs/platform',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getPlatformCostsHandler,
  );

  app.get(
    '/api/agent-portal/costs/breakdown',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getCostBreakdownHandler,
  );
}
