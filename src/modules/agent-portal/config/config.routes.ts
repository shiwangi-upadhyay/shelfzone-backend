import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import {
  changeModelHandler,
  updatePromptHandler,
  adjustParamsHandler,
  toggleAgentHandler,
  getConfigHistoryHandler,
} from './config.controller.js';

export default async function configRoutes(app: FastifyInstance) {
  app.put(
    '/api/agent-portal/config/:agentId/model',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    changeModelHandler,
  );

  app.put(
    '/api/agent-portal/config/:agentId/prompt',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updatePromptHandler,
  );

  app.put(
    '/api/agent-portal/config/:agentId/params',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    adjustParamsHandler,
  );

  app.put(
    '/api/agent-portal/config/:agentId/toggle',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    toggleAgentHandler,
  );

  app.get(
    '/api/agent-portal/config/:agentId/history',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getConfigHistoryHandler,
  );
}
