import { z } from 'zod';

export const instructSchema = z.object({
  instruction: z.string().min(1).max(5000).trim(),
  masterAgentId: z.string().optional(),
});

export const traceParamsSchema = z.object({
  traceId: z.string().min(1),
});
