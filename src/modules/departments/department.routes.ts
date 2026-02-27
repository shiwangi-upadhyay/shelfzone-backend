import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  createDepartmentHandler,
  listDepartmentsHandler,
  getDepartmentHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
} from './department.controller.js';

export default async function departmentRoutes(app: FastifyInstance) {
  app.post(
    '/api/departments',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createDepartmentHandler,
  );

  app.get(
    '/api/departments',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    listDepartmentsHandler,
  );

  app.get(
    '/api/departments/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    getDepartmentHandler,
  );

  app.put(
    '/api/departments/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updateDepartmentHandler,
  );

  app.delete(
    '/api/departments/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    deleteDepartmentHandler,
  );
}
