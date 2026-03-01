import { z } from 'zod';

export const createTraceSchema = z.object({
  instruction: z.string().min(1).max(5000),
  masterAgentId: z.string().optional(),
});

export const updateTraceSchema = z.object({
  status: z.enum(['running', 'completed', 'error', 'cancelled']).optional(),
  completedAt: z.string().datetime().optional(),
});

export const listTracesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  agentId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.string().cuid(),
});

export const traceIdParamSchema = z.object({
  traceId: z.string().cuid(),
});

export const agentIdParamSchema = z.object({
  agentId: z.string(),
});

export const sessionEventsQuerySchema = z.object({
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createEventSchema = z.object({
  type: z.string().min(1),
  content: z.string().optional(),
  fromAgentId: z.string().optional(),
  toAgentId: z.string().optional(),
  metadata: z.any().optional(),
  tokenCount: z.number().int().min(0).optional(),
  cost: z.number().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
});

export const employeeIdParamSchema = z.object({
  id: z.string(),
});

export const agentStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
