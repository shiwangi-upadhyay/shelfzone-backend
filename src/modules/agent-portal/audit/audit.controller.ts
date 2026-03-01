import { FastifyRequest, FastifyReply } from 'fastify';
import { listAuditLogsQuerySchema } from './audit.schemas.js';
import * as auditService from './audit.service.js';

export async function listAuditLogsHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = listAuditLogsQuerySchema.safeParse(request.query);
  
  if (!parsed.success) {
    return reply
      .status(400)
      .send({ error: 'Validation Error', message: parsed.error.issues[0].message });
  }

  try {
    const result = await auditService.getAuditLogs(parsed.data);
    return reply.send(result);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; error?: string; message?: string };
    return reply
      .status(e.statusCode ?? 500)
      .send({ error: e.error ?? 'Internal Error', message: e.message });
  }
}
