import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import { listSessionLogsHandler, getSessionDetailHandler } from './session-log.controller.js';

export default async function sessionLogRoutes(app: FastifyInstance) {
  app.get(
    '/api/agent-portal/sessions',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    listSessionLogsHandler,
  );

  app.get(
    '/api/agent-portal/sessions/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getSessionDetailHandler,
  );
}
