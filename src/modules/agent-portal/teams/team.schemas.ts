import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  leadAgentId: z.string().cuid().optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  leadAgentId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const teamParamsSchema = z.object({
  id: z.string().cuid(),
});

export const assignAgentSchema = z.object({
  agentId: z.string().cuid(),
});

export const removeAgentParamsSchema = z.object({
  id: z.string().cuid(),
  agentId: z.string().cuid(),
});

export const listTeamsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
