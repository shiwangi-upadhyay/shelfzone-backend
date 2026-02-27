import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  slug: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  type: z.enum(['CHAT', 'WORKFLOW', 'SCHEDULED', 'INTEGRATION']),
  model: z.string().min(1).max(100).trim(),
  systemPrompt: z.string().max(50000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200000).optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
  capabilities: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  isCritical: z.boolean().optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  slug: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  type: z.enum(['CHAT', 'WORKFLOW', 'SCHEDULED', 'INTEGRATION']).optional(),
  model: z.string().min(1).max(100).trim().optional(),
  systemPrompt: z.string().max(50000).nullable().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200000).optional(),
  timeoutMs: z.number().int().min(1000).max(600000).optional(),
  capabilities: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  isCritical: z.boolean().optional(),
});

export const agentParamsSchema = z.object({
  id: z.string().cuid(),
});

export const listAgentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).trim().optional(),
  type: z.enum(['CHAT', 'WORKFLOW', 'SCHEDULED', 'INTEGRATION']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'PAUSED', 'ARCHIVED']).optional(),
  teamId: z.string().cuid().optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type ListAgentsQuery = z.infer<typeof listAgentsQuerySchema>;
