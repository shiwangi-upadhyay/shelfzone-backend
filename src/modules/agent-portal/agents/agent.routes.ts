import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import {
  registerAgentHandler,
  updateAgentHandler,
  deactivateAgentHandler,
  archiveAgentHandler,
  listAgentsHandler,
  getAgentHandler,
  getAgentDetailHandler,
  getAgentHierarchyHandler,
  healthCheckHandler,
  syncFromOpenClawHandler,
} from './agent.controller.js';

export default async function agentRoutes(app: FastifyInstance) {
  // Sync agents from OpenClaw config (must be before generic routes)
  app.get(
    '/api/agent-portal/agents/sync-from-openclaw',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    syncFromOpenClawHandler,
  );

  app.post(
    '/api/agent-portal/agents',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    registerAgentHandler,
  );

  app.get(
    '/api/agent-portal/agents/hierarchy',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER')] },
    getAgentHierarchyHandler,
  );

  app.get(
    '/api/agent-portal/agents',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER')] },
    listAgentsHandler,
  );

  app.get(
    '/api/agent-portal/agents/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER')] },
    getAgentHandler,
  );

  app.get(
    '/api/agent-portal/agents/:id/detail',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getAgentDetailHandler,
  );

  app.put(
    '/api/agent-portal/agents/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updateAgentHandler,
  );

  app.put(
    '/api/agent-portal/agents/:id/deactivate',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    deactivateAgentHandler,
  );

  app.put(
    '/api/agent-portal/agents/:id/archive',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN')] },
    archiveAgentHandler,
  );

  app.post(
    '/api/agent-portal/agents/:id/health-check',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    healthCheckHandler,
  );
}
