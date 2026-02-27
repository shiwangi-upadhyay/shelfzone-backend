import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import {
  createApiKeyHandler,
  listApiKeysHandler,
  rotateApiKeyHandler,
  revokeApiKeyHandler,
} from './api-key.controller.js';

export default async function apiKeyRoutes(app: FastifyInstance) {
  app.post(
    '/api/agent-portal/agents/:agentId/api-keys',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createApiKeyHandler,
  );

  app.get(
    '/api/agent-portal/agents/:agentId/api-keys',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    listApiKeysHandler,
  );

  app.post(
    '/api/agent-portal/api-keys/:id/rotate',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    rotateApiKeyHandler,
  );

  app.delete(
    '/api/agent-portal/api-keys/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    revokeApiKeyHandler,
  );
}
