import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(1000).trim().optional(),
  type: z.enum(['CHAT', 'WORKFLOW', 'SCHEDULED', 'INTEGRATION']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  systemPrompt: z.string().max(10000).trim().optional(),
  model: z.string().min(1).max(100).trim(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  tools: z.array(z.record(z.string(), z.unknown())).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(1000).trim().nullable().optional(),
  type: z.enum(['CHAT', 'WORKFLOW', 'SCHEDULED', 'INTEGRATION']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'PAUSED', 'ARCHIVED']).optional(),
  systemPrompt: z.string().max(10000).trim().nullable().optional(),
  model: z.string().min(1).max(100).trim().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  tools: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const agentParamsSchema = z.object({
  id: z.string().cuid(),
});

export const listAgentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).trim().optional(),
  type: z.enum(['CHAT', 'WORKFLOW', 'SCHEDULED', 'INTEGRATION']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type ListAgentsQuery = z.infer<typeof listAgentsQuerySchema>;
