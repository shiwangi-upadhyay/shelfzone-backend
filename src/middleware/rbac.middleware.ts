import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';

export function requireRole(...roles: Role[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user;

    if (!user || !roles.includes(user.role as Role)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }
  };
}
