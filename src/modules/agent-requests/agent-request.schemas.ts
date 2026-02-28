import { z } from 'zod';

export const createRequestSchema = z.object({
  agentId: z.string().min(1),
  purpose: z.string().min(5).max(500),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

export const reviewRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().max(500).optional(),
});

export const listRequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
