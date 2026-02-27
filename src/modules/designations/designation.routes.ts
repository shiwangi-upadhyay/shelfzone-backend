import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  createDesignationHandler,
  listDesignationsHandler,
  getDesignationHandler,
  updateDesignationHandler,
  deleteDesignationHandler,
} from './designation.controller.js';

export default async function designationRoutes(app: FastifyInstance) {
  app.post(
    '/api/designations',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createDesignationHandler,
  );

  app.get(
    '/api/designations',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    listDesignationsHandler,
  );

  app.get(
    '/api/designations/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    getDesignationHandler,
  );

  app.put(
    '/api/designations/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updateDesignationHandler,
  );

  app.delete(
    '/api/designations/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    deleteDesignationHandler,
  );
}
