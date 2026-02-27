import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  initializeBalancesHandler,
  initializeAllBalancesHandler,
  adjustBalanceHandler,
  getBalanceHandler,
  carryForwardHandler,
} from './leave-admin.controller.js';

export default async function leaveAdminRoutes(app: FastifyInstance) {
  app.post(
    '/api/leave-admin/initialize',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    initializeBalancesHandler,
  );

  app.post(
    '/api/leave-admin/initialize-all',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    initializeAllBalancesHandler,
  );

  app.post(
    '/api/leave-admin/adjust',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    adjustBalanceHandler,
  );

  app.get(
    '/api/leave-admin/balance',
    {
      preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')],
    },
    getBalanceHandler,
  );

  app.post(
    '/api/leave-admin/carry-forward',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    carryForwardHandler,
  );
}
