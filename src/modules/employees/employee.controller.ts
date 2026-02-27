import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  getEmployeeParamsSchema,
  listEmployeesQuerySchema,
} from './employee.schemas.js';
import * as employeeService from './employee.service.js';

export async function createEmployeeHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createEmployeeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const employee = await employeeService.createEmployee(parsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'Employee',
      resourceId: (employee as Record<string, unknown>).id as string,
      details: { employeeCode: String((employee as Record<string, unknown>).employeeCode) },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: employee });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listEmployeesHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listEmployeesQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  const result = await employeeService.getEmployees(parsed.data, request.user!);
  return reply.send(result);
}

export async function getEmployeeHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getEmployeeParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const employee = await employeeService.getEmployeeById(parsed.data.id, request.user!);
    return reply.send({ data: employee });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function updateEmployeeHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = getEmployeeParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: paramsParsed.error.issues[0].message });
  }

  const bodyParsed = updateEmployeeSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: bodyParsed.error.issues[0].message });
  }

  try {
    const employee = await employeeService.updateEmployee(
      paramsParsed.data.id,
      bodyParsed.data,
      request.user!,
    );
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'Employee',
      resourceId: paramsParsed.data.id,
      details: Object.keys(bodyParsed.data),
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: employee });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function deleteEmployeeHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getEmployeeParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const employee = await employeeService.deleteEmployee(parsed.data.id, request.user!);
    logAudit({
      userId: request.user!.userId,
      action: 'DELETE',
      resource: 'Employee',
      resourceId: parsed.data.id,
      details: { softDelete: true, status: 'TERMINATED' },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: employee });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
