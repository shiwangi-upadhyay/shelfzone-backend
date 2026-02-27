import { FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from '../../lib/audit.js';
import {
  updateProfileSchema,
  getMyPayslipsQuerySchema,
  getMyAttendanceQuerySchema,
  getMyLeavesQuerySchema,
} from './self-service.schemas.js';
import * as selfServiceService from './self-service.service.js';

export async function getMyProfileHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const profile = await selfServiceService.getMyProfile(request.user!.userId);
    return reply.send({ data: profile });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: error.message || 'Internal Server Error' });
  }
}

export async function updateMyProfileHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = updateProfileSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const updated = await selfServiceService.updateMyProfile(request.user!.userId, parsed.data);

    logAudit({
      userId: request.user!.userId,
      action: 'UPDATE',
      resource: 'SelfService:Profile',
      resourceId: (updated as Record<string, unknown>).id as string,
      details: { updatedFields: Object.keys(parsed.data) },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.send({ data: updated });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: error.message || 'Internal Server Error' });
  }
}

export async function getMyPayslipsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getMyPayslipsQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await selfServiceService.getMyPayslips(request.user!.userId, parsed.data);
    return reply.send(result);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: error.message || 'Internal Server Error' });
  }
}

export async function getMyAttendanceHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getMyAttendanceQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await selfServiceService.getMyAttendance(request.user!.userId, parsed.data);
    return reply.send(result);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: error.message || 'Internal Server Error' });
  }
}

export async function getMyLeavesHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = getMyLeavesQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await selfServiceService.getMyLeaves(request.user!.userId, parsed.data);
    return reply.send(result);
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: error.message || 'Internal Server Error' });
  }
}

export async function getMyDashboardHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const result = await selfServiceService.getMyDashboard(request.user!.userId);
    return reply.send({ data: result });
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    return reply
      .status(error.statusCode ?? 500)
      .send({ error: error.message || 'Internal Server Error' });
  }
}
