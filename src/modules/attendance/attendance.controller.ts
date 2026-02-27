import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  checkInSchema,
  checkOutSchema,
  regularizeSchema,
  getAttendanceParamsSchema,
  listAttendanceQuerySchema,
} from './attendance.schemas.js';
import * as attendanceService from './attendance.service.js';
import prisma from '../../lib/prisma.js';

async function getEmployeeId(userId: string): Promise<string> {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    throw { statusCode: 404, error: 'Not Found', message: 'Employee profile not found' };
  }
  return employee.id;
}

export async function checkInHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = checkInSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const employeeId = await getEmployeeId(request.user!.userId);
    const record = await attendanceService.checkIn(employeeId, parsed.data.note);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'AttendanceRecord',
      resourceId: record.id,
      details: { type: 'check-in', status: record.status },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: record });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function checkOutHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = checkOutSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const employeeId = await getEmployeeId(request.user!.userId);
    const record = await attendanceService.checkOut(employeeId, parsed.data.note);
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'AttendanceRecord',
      resourceId: record.id,
      details: { type: 'check-out', hoursWorked: record.hoursWorked, status: record.status },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: record });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function regularizeHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = regularizeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const record = await attendanceService.regularizeAttendance(parsed.data, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'AttendanceRecord',
      resourceId: record.id,
      details: {
        type: 'regularize',
        employeeId: parsed.data.employeeId,
        date: parsed.data.date,
        status: parsed.data.status,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: record });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listAttendanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listAttendanceQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await attendanceService.getAttendance(parsed.data, request.user!);
    return reply.send(result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function getAttendanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getAttendanceParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const record = await attendanceService.getAttendanceById(parsed.data.id);
    return reply.send({ data: record });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
