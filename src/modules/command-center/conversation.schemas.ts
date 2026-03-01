import { z } from 'zod';

export const createConversationSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  title: z.string().optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
