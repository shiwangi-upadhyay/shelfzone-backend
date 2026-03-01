import { z } from 'zod';

export const sendMessageSchema = z.object({
  agentId: z.string().cuid(),
  conversationId: z.string().cuid().optional().nullable(),
  message: z.string().min(1, 'Message cannot be empty'),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
