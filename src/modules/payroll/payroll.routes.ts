import { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../middleware/index.js';
import {
  createSalaryStructureHandler,
  getSalaryStructureHandler,
  createPayrollRunHandler,
  processPayrollRunHandler,
  getPayslipHandler,
  listPayslipsHandler,
} from './payroll.controller.js';

export default async function payrollRoutes(app: FastifyInstance) {
  app.post(
    '/api/payroll/salary-structure',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createSalaryStructureHandler,
  );

  app.get(
    '/api/payroll/salary-structure/:employeeId',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    getSalaryStructureHandler,
  );

  app.post(
    '/api/payroll/run',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    createPayrollRunHandler,
  );

  app.post(
    '/api/payroll/run/:id/process',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN')] },
    processPayrollRunHandler,
  );

  app.get(
    '/api/payroll/payslips',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    listPayslipsHandler,
  );

  app.get(
    '/api/payroll/payslips/:id',
    { preHandler: [authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE')] },
    getPayslipHandler,
  );
}
