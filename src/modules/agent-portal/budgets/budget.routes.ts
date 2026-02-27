import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../../middleware/index.js';
import {
  setBudgetHandler,
  listBudgetsHandler,
  checkBudgetHandler,
  unpauseHandler,
} from './budget.controller.js';

export default async function budgetRoutes(app: FastifyInstance) {
  app.post(
    '/api/agent-portal/budgets',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    setBudgetHandler,
  );

  app.get(
    '/api/agent-portal/budgets',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    listBudgetsHandler,
  );

  app.get(
    '/api/agent-portal/budgets/check/:agentId',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    checkBudgetHandler,
  );

  app.put(
    '/api/agent-portal/budgets/:id/unpause',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN')] },
    unpauseHandler,
  );
}
