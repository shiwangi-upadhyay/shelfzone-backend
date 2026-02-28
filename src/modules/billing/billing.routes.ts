import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  summaryHandler,
  byAgentHandler,
  byEmployeeHandler,
  byModelHandler,
  invoicesHandler,
  exportHandler,
} from './billing.controller.js';

export default async function billingRoutes(app: FastifyInstance) {
  app.get(
    '/api/billing/summary',
    { preHandler: [authenticate] },
    summaryHandler,
  );

  app.get(
    '/api/billing/by-agent',
    { preHandler: [authenticate] },
    byAgentHandler,
  );

  app.get(
    '/api/billing/by-employee',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    byEmployeeHandler,
  );

  app.get(
    '/api/billing/by-model',
    { preHandler: [authenticate] },
    byModelHandler,
  );

  app.get(
    '/api/billing/invoices',
    { preHandler: [authenticate] },
    invoicesHandler,
  );

  app.get(
    '/api/billing/export',
    { preHandler: [authenticate] },
    exportHandler,
  );
}
