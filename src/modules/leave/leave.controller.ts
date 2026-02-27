import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  applyLeaveSchema,
  reviewLeaveSchema,
  leaveParamsSchema,
  listLeavesQuerySchema,
} from './leave.schemas.js';
import * as leaveService from './leave.service.js';
import prisma from '../../lib/prisma.js';

async function getEmployeeId(userId: string): Promise<string> {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    throw { statusCode: 404, error: 'Not Found', message: 'Employee profile not found' };
  }
  return employee.id;
}

export async function applyLeaveHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = applyLeaveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const employeeId = await getEmployeeId(request.user!.userId);
    const leave = await leaveService.applyLeave(employeeId, parsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'LeaveRequest',
      resourceId: leave.id,
      details: {
        leaveType: parsed.data.leaveType,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        totalDays: leave.totalDays,
      },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: leave });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function reviewLeaveHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = leaveParamsSchema.safeParse(request.params);
  if (!params.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  }

  const parsed = reviewLeaveSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const leave = await leaveService.reviewLeave(params.data.id, request.user!.userId, parsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'LeaveRequest',
      resourceId: leave.id,
      details: { status: parsed.data.status, reviewNote: parsed.data.reviewNote },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: leave });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function cancelLeaveHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = leaveParamsSchema.safeParse(request.params);
  if (!params.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  }

  try {
    const leave = await leaveService.cancelLeave(params.data.id, request.user!.userId);
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'LeaveRequest',
      resourceId: leave.id,
      details: { action: 'cancel', previousStatus: 'see-audit' },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: leave });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listLeavesHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listLeavesQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await leaveService.getLeaves(parsed.data, request.user!);
    return reply.send(result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function getLeaveHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = leaveParamsSchema.safeParse(request.params);
  if (!params.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: params.error.issues[0].message });
  }

  try {
    const leave = await leaveService.getLeaveById(params.data.id, request.user!);
    return reply.send({ data: leave });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
