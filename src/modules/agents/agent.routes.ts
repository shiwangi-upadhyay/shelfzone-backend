import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  createAgentHandler,
  listAgentsHandler,
  getAgentHandler,
  updateAgentHandler,
  deleteAgentHandler,
} from './agent.controller.js';

export default async function agentRoutes(app: FastifyInstance) {
  app.post(
    '/api/agents',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createAgentHandler,
  );

  app.get('/api/agents', { preHandler: [authenticate] }, listAgentsHandler);

  app.get('/api/agents/:id', { preHandler: [authenticate] }, getAgentHandler);

  app.put(
    '/api/agents/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updateAgentHandler,
  );

  app.delete(
    '/api/agents/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN')] },
    deleteAgentHandler,
  );
}
