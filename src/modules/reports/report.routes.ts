import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import {
  dailyReportHandler,
  weeklyReportHandler,
  monthlyReportHandler,
} from './attendance-report.controller.js';
import {
  DailyReportQuerySchema,
  WeeklyReportQuerySchema,
  MonthlyReportQuerySchema,
} from './report.schemas.js';

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get(
    '/attendance/daily',
    {
      preHandler: [requireRole('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')],
      schema: { querystring: DailyReportQuerySchema },
    },
    dailyReportHandler,
  );

  fastify.get(
    '/attendance/weekly',
    {
      preHandler: [requireRole('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')],
      schema: { querystring: WeeklyReportQuerySchema },
    },
    weeklyReportHandler,
  );

  fastify.get(
    '/attendance/monthly',
    {
      preHandler: [requireRole('MANAGER', 'HR_ADMIN', 'SUPER_ADMIN')],
      schema: { querystring: MonthlyReportQuerySchema },
    },
    monthlyReportHandler,
  );
}
