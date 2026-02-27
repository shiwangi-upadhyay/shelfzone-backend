import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  checkInHandler,
  checkOutHandler,
  regularizeHandler,
  listAttendanceHandler,
  getAttendanceHandler,
} from './attendance.controller.js';

export default async function attendanceRoutes(app: FastifyInstance) {
  app.post('/api/attendance/check-in', { preHandler: [authenticate] }, checkInHandler);

  app.post('/api/attendance/check-out', { preHandler: [authenticate] }, checkOutHandler);

  app.post(
    '/api/attendance/regularize',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    regularizeHandler,
  );

  app.get('/api/attendance', { preHandler: [authenticate] }, listAttendanceHandler);

  app.get('/api/attendance/:id', { preHandler: [authenticate] }, getAttendanceHandler);
}
