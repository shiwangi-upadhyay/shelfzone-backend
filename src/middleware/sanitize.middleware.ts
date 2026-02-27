import { FastifyRequest, FastifyReply } from 'fastify';
import { sanitizeInput, validateInput } from '../lib/sanitize.js';

/**
 * Fastify preHandler that sanitizes all string fields in request body.
 */
export async function sanitizeBody(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.body || typeof request.body !== 'object') {
    return;
  }

  const body = request.body as Record<string, unknown>;

  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') continue;

    // Skip password fields — don't sanitize credentials
    if (key.toLowerCase().includes('password') || key.toLowerCase().includes('token')) {
      continue;
    }

    const validation = validateInput(value);
    if (!validation.safe) {
      reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid input in field '${key}': ${validation.reason}`,
      });
      return;
    }

    (body as Record<string, unknown>)[key] = sanitizeInput(value);
  }
}
