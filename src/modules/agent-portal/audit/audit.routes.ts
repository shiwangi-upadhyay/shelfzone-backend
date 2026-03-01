import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import { listAuditLogsHandler } from './audit.controller.js';

export default async function auditRoutes(app: FastifyInstance) {
  app.get(
    '/api/agent-portal/audit',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    listAuditLogsHandler,
  );
}
