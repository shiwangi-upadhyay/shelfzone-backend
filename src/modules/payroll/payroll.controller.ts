import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  createSalaryStructureSchema,
  salaryStructureParamsSchema,
  createPayrollRunSchema,
  processPayrollSchema,
  getPayslipParamsSchema,
  listPayslipsQuerySchema,
} from './payroll.schemas.js';
import * as payrollService from './payroll.service.js';

export async function createSalaryStructureHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createSalaryStructureSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await payrollService.createSalaryStructure(parsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'SalaryStructure',
      resourceId: result.id,
      details: { employeeId: parsed.data.employeeId },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function getSalaryStructureHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = salaryStructureParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await payrollService.getSalaryStructure(parsed.data.employeeId, request.user!);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function createPayrollRunHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createPayrollRunSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await payrollService.createPayrollRun(parsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'PayrollRun',
      resourceId: result.id,
      details: { month: parsed.data.month, year: parsed.data.year },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function processPayrollRunHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = processPayrollSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await payrollService.processPayrollRun(parsed.data.id, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'PROCESS',
      resource: 'PayrollRun',
      resourceId: parsed.data.id,
      details: { status: 'COMPLETED', totalEmployees: result.totalEmployees },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function getPayslipHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getPayslipParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await payrollService.getPayslipById(parsed.data.id, request.user!);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listPayslipsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listPayslipsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await payrollService.getPayslips(parsed.data, request.user!);
    return reply.send(result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
