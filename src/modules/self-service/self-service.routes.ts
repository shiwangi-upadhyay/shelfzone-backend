import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/index.js';
import {
  getMyProfileHandler,
  updateMyProfileHandler,
  getMyPayslipsHandler,
  getMyAttendanceHandler,
  getMyLeavesHandler,
  getMyDashboardHandler,
} from './self-service.controller.js';

export default async function selfServiceRoutes(app: FastifyInstance) {
  app.get('/api/me/profile', { preHandler: [authenticate] }, getMyProfileHandler);

  app.put('/api/me/profile', { preHandler: [authenticate] }, updateMyProfileHandler);

  app.get('/api/me/payslips', { preHandler: [authenticate] }, getMyPayslipsHandler);

  app.get('/api/me/attendance', { preHandler: [authenticate] }, getMyAttendanceHandler);

  app.get('/api/me/leaves', { preHandler: [authenticate] }, getMyLeavesHandler);

  app.get('/api/me/dashboard', { preHandler: [authenticate] }, getMyDashboardHandler);
}
