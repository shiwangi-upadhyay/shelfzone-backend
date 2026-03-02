import { z } from 'zod';

export const shareAgentSchema = z.object({
  sharedWithUserId: z.string().min(1, 'User ID is required'),
  permission: z.enum(['control', 'view']).default('view'),
  mode: z.enum(['route', 'collaborate', 'transfer']).default('route'),
  conversationId: z.string().optional(),
  costLimit: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
});

export const updateShareSchema = z.object({
  permission: z.enum(['control', 'view']).optional(),
  mode: z.enum(['route', 'collaborate', 'transfer']).optional(),
  costLimit: z.number().positive().optional(),
  expiresAt: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
});

export type ShareAgentInput = z.infer<typeof shareAgentSchema>;
export type UpdateShareInput = z.infer<typeof updateShareSchema>;
