import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import { listCommandsHandler, getCommandDetailHandler } from './command.controller.js';

export default async function commandRoutes(app: FastifyInstance) {
  app.get(
    '/api/agent-portal/commands',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    listCommandsHandler,
  );

  app.get(
    '/api/agent-portal/commands/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    getCommandDetailHandler,
  );
}
