import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import {
  createTeamHandler,
  updateTeamHandler,
  listTeamsHandler,
  getTeamHandler,
  assignAgentHandler,
  removeAgentHandler,
  getTeamStatsHandler,
} from './team.controller.js';

export default async function teamRoutes(app: FastifyInstance) {
  app.post(
    '/api/agent-portal/teams',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createTeamHandler,
  );

  app.get(
    '/api/agent-portal/teams',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER')] },
    listTeamsHandler,
  );

  app.get(
    '/api/agent-portal/teams/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER')] },
    getTeamHandler,
  );

  app.put(
    '/api/agent-portal/teams/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updateTeamHandler,
  );

  app.post(
    '/api/agent-portal/teams/:id/assign-agent',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    assignAgentHandler,
  );

  app.delete(
    '/api/agent-portal/teams/:id/remove-agent/:agentId',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    removeAgentHandler,
  );

  app.get(
    '/api/agent-portal/teams/:id/stats',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getTeamStatsHandler,
  );
}
