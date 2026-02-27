import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  createEmployeeHandler,
  listEmployeesHandler,
  getEmployeeHandler,
  updateEmployeeHandler,
  deleteEmployeeHandler,
} from './employee.controller.js';

export default async function employeeRoutes(app: FastifyInstance) {
  app.post(
    '/api/employees',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createEmployeeHandler,
  );

  app.get(
    '/api/employees',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    listEmployeesHandler,
  );

  app.get(
    '/api/employees/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    getEmployeeHandler,
  );

  app.put(
    '/api/employees/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    updateEmployeeHandler,
  );

  app.delete(
    '/api/employees/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    deleteEmployeeHandler,
  );
}
