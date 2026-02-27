import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  getDepartmentParamsSchema,
  listDepartmentsQuerySchema,
} from './department.schemas.js';
import * as departmentService from './department.service.js';

export async function createDepartmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = createDepartmentSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const department = await departmentService.createDepartment(parsed.data);
    logAudit({
      userId: request.user!.userId,
      action: 'CREATE',
      resource: 'Department',
      resourceId: department.id,
      details: { name: department.name },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(201).send({ data: department });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function listDepartmentsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listDepartmentsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  const result = await departmentService.getDepartments(parsed.data);
  return reply.send(result);
}

export async function getDepartmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getDepartmentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const department = await departmentService.getDepartmentById(parsed.data.id);
    return reply.send({ data: department });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function updateDepartmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const paramsParsed = getDepartmentParamsSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: paramsParsed.error.issues[0].message });
  }

  const bodyParsed = updateDepartmentSchema.safeParse(request.body);
  if (!bodyParsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: bodyParsed.error.issues[0].message });
  }

  try {
    const department = await departmentService.updateDepartment(
      paramsParsed.data.id,
      bodyParsed.data,
    );
    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'Department',
      resourceId: department.id,
      details: bodyParsed.data,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: department });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}

export async function deleteDepartmentHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getDepartmentParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    await departmentService.deleteDepartment(parsed.data.id);
    logAudit({
      userId: request.user!.userId,
      action: 'DELETE',
      resource: 'Department',
      resourceId: parsed.data.id,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
    return reply.send({ data: { message: 'Department deactivated successfully' } });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
