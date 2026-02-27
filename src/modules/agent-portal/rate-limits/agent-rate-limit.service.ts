import prisma from '../../../lib/prisma.js';

const DEFAULT_RATE_LIMIT = 60; // requests per minute
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

interface AgentRateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Get the rate limit configuration for a specific agent.
 * Falls back to defaults if not configured in agent metadata.
 */
export async function getAgentRateLimitConfig(agentId: string): Promise<AgentRateLimitConfig> {
  const agent = await prisma.agentRegistry.findUnique({
    where: { id: agentId },
    select: { metadata: true },
  });

  const metadata = agent?.metadata as Record<string, unknown> | null;
  const rateLimit = metadata?.rateLimit as Record<string, number> | undefined;

  return {
    maxRequests: rateLimit?.maxRequests ?? DEFAULT_RATE_LIMIT,
    windowMs: rateLimit?.windowMs ?? DEFAULT_WINDOW_MS,
  };
}
