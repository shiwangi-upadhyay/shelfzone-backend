import { z } from 'zod';

export const instructSchema = z.object({
  instruction: z.string().min(1).max(5000).trim(),
  masterAgentId: z.string().optional(),
});

export const executeMultiSchema = z.object({
  agentIds: z.array(z.string()).min(1).max(10),
  instruction: z.string().min(1).max(5000).trim(),
  mode: z.enum(['parallel', 'sequential', 'delegate']).default('parallel'),
});

export const traceParamsSchema = z.object({
  traceId: z.string().min(1),
});
