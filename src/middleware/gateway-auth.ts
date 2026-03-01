import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';

/**
 * Gateway API Key authentication middleware
 * Accepts X-Api-Key header for external systems (OpenClaw, etc.)
 * Falls back to standard JWT auth if no API key present
 */
export async function gatewayAuth(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'] as string;

  if (apiKey) {
    // Static gateway API key (stored in env or config)
    const validKey = process.env.GATEWAY_API_KEY || 'shelfzone-gateway-dev-key';
    
    if (apiKey !== validKey) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid API key' });
    }

    // Map to system owner (shiwangi@shelfex.com)
    const user = await prisma.user.findUnique({
      where: { email: 'shiwangi@shelfex.com' },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return reply.status(500).send({ error: 'Internal Error', message: 'Gateway owner not found' });
    }

    // Attach user to request (same format as JWT auth)
    (request as any).user = { userId: user.id, email: user.email, role: user.role };
    return;
  }

  // No API key — fall back to JWT auth
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'No authentication provided' });
  }

  const token = authHeader.slice(7);
  try {
    const { verifyAccessToken } = await import('../modules/auth/auth.service.js');
    const payload = verifyAccessToken(token);
    (request as any).user = payload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
  }
}
