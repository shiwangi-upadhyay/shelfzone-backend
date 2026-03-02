import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  listHolidaysHandler,
  getUpcomingHolidaysHandler,
  createHolidayHandler,
  updateHolidayHandler,
  deleteHolidayHandler,
} from './holiday.controller.js';

export default async function holidayRoutes(app: FastifyInstance) {
  // GET /api/holidays - List all holidays (with filters)
  app.get('/api/holidays', { preHandler: [authenticate] }, listHolidaysHandler);

  // GET /api/holidays/upcoming - Get next 5 upcoming holidays
  app.get('/api/holidays/upcoming', { preHandler: [authenticate] }, getUpcomingHolidaysHandler);

  // POST /api/holidays - Create holiday (admin only)
  app.post(
    '/api/holidays',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createHolidayHandler
  );

  // PUT /api/holidays/:id - Update holiday (admin only)
  app.put(
    '/api/holidays/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updateHolidayHandler
  );

  // DELETE /api/holidays/:id - Delete holiday (admin only)
  app.delete(
    '/api/holidays/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    deleteHolidayHandler
  );
}
