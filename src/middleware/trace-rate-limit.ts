import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * In-memory rate limiter for AgentTrace endpoints.
 * No Redis dependency — uses Maps with automatic cleanup.
 */

// ── SSE concurrent connections ────────────────────────────────────────

const sseConnections = new Map<string, number>(); // userId → active count
const MAX_SSE_PER_USER = 5;

export function acquireSSESlot(userId: string): boolean {
  const current = sseConnections.get(userId) ?? 0;
  if (current >= MAX_SSE_PER_USER) return false;
  sseConnections.set(userId, current + 1);
  return true;
}

export function releaseSSESlot(userId: string): void {
  const current = sseConnections.get(userId) ?? 0;
  if (current <= 1) {
    sseConnections.delete(userId);
  } else {
    sseConnections.set(userId, current - 1);
  }
}

// ── Sliding-window rate limiter ───────────────────────────────────────

interface WindowEntry {
  timestamps: number[];
}

const windows = new Map<string, WindowEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [key, entry] of windows) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) windows.delete(key);
  }
}, 300_000).unref();

function checkRate(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  let entry = windows.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    windows.set(key, entry);
  }
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
  if (entry.timestamps.length >= maxRequests) return false;
  entry.timestamps.push(now);
  return true;
}

// ── Fastify hooks ─────────────────────────────────────────────────────

/**
 * Rate limit: 100 events/minute per session for event creation.
 */
export function eventCreationLimit(sessionId: string): boolean {
  return checkRate(`evt:${sessionId}`, 100, 60_000);
}

/**
 * Rate limit: 30 requests/minute per user for trace listing.
 */
export function traceListingLimit(userId: string): boolean {
  return checkRate(`list:${userId}`, 30, 60_000);
}

/**
 * Fastify preHandler for trace listing endpoints.
 */
export async function traceListingRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const userId = (request as any).user?.id;
  if (!userId) return;
  if (!traceListingLimit(userId)) {
    reply.code(429).send({ error: 'Too many requests. Max 30 trace listings per minute.' });
  }
}

/**
 * Fastify preHandler for event creation endpoints.
 */
export async function eventCreationRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const sessionId = (request.params as any)?.sessionId ?? (request.body as any)?.sessionId;
  if (!sessionId) return;
  if (!eventCreationLimit(sessionId)) {
    reply.code(429).send({ error: 'Too many events. Max 100 per minute per session.' });
  }
}

// ── Testing helpers ───────────────────────────────────────────────────

export function _resetForTesting(): void {
  sseConnections.clear();
  windows.clear();
}
