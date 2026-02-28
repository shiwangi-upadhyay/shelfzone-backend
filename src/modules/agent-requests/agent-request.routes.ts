import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  createHandler,
  listHandler,
  myRequestsHandler,
  getHandler,
  reviewHandler,
  cancelHandler,
  statsHandler,
} from './agent-request.controller.js';

export default async function agentRequestRoutes(app: FastifyInstance) {
  // Any authenticated user can create a request
  app.post('/api/agent-requests', { preHandler: [authenticate] }, createHandler);

  // Get my own requests
  app.get('/api/agent-requests/mine', { preHandler: [authenticate] }, myRequestsHandler);

  // Admin: list all requests
  app.get('/api/agent-requests', { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] }, listHandler);

  // Admin: stats
  app.get('/api/agent-requests/stats', { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] }, statsHandler);

  // Get single request
  app.get('/api/agent-requests/:id', { preHandler: [authenticate] }, getHandler);

  // Admin: approve/reject
  app.put('/api/agent-requests/:id/review', { preHandler: [authenticate, requireRole('SUPER_ADMIN')] }, reviewHandler);

  // Requester: cancel own request
  app.put('/api/agent-requests/:id/cancel', { preHandler: [authenticate] }, cancelHandler);
}
