import { FastifyRequest, FastifyReply } from 'fastify';
import { getAgentRateLimitConfig } from '../modules/agent-portal/rate-limits/agent-rate-limit.service.js';

/**
 * In-memory sliding window rate limiter per agent.
 * Maps agentId → array of request timestamps.
 */
const agentRequestLog = new Map<string, number[]>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [agentId, timestamps] of agentRequestLog.entries()) {
    const fresh = timestamps.filter((t) => now - t < 300_000);
    if (fresh.length === 0) {
      agentRequestLog.delete(agentId);
    } else {
      agentRequestLog.set(agentId, fresh);
    }
  }
}, 300_000);

/**
 * Fastify preHandler that enforces per-agent rate limits.
 * Agent ID is read from params or x-agent-id header.
 */
export async function agentRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const agentId =
    (request.params as Record<string, string>).agentId ?? (request.headers['x-agent-id'] as string);

  if (!agentId) return; // No agent context — skip

  const config = await getAgentRateLimitConfig(agentId);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let timestamps = agentRequestLog.get(agentId) ?? [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= config.maxRequests) {
    const retryAfter = Math.ceil((timestamps[0] + config.windowMs - now) / 1000);
    reply
      .status(429)
      .header('Retry-After', String(retryAfter))
      .header('X-RateLimit-Limit', String(config.maxRequests))
      .header('X-RateLimit-Remaining', '0')
      .send({
        error: 'Too Many Requests',
        message: `Agent rate limit exceeded. Max ${config.maxRequests} requests per ${config.windowMs / 1000}s.`,
        retryAfter,
      });
    return;
  }

  timestamps.push(now);
  agentRequestLog.set(agentId, timestamps);

  reply.header('X-RateLimit-Limit', String(config.maxRequests));
  reply.header('X-RateLimit-Remaining', String(config.maxRequests - timestamps.length));
}
