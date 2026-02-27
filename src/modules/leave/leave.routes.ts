import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  applyLeaveHandler,
  reviewLeaveHandler,
  cancelLeaveHandler,
  listLeavesHandler,
  getLeaveHandler,
} from './leave.controller.js';

export default async function leaveRoutes(app: FastifyInstance) {
  app.post('/api/leave/apply', { preHandler: [authenticate] }, applyLeaveHandler);

  app.put(
    '/api/leave/:id/review',
    { preHandler: [authenticate, requireRole('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')] },
    reviewLeaveHandler,
  );

  app.put('/api/leave/:id/cancel', { preHandler: [authenticate] }, cancelLeaveHandler);

  app.get('/api/leave', { preHandler: [authenticate] }, listLeavesHandler);

  app.get('/api/leave/:id', { preHandler: [authenticate] }, getLeaveHandler);
}
