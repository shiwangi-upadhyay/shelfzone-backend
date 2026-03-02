import { z } from 'zod';

export const fileAttachmentSchema = z.object({
  type: z.enum(['image', 'text']),
  content: z.string(), // base64 for images, text for code
  metadata: z.object({
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    uploadedAt: z.string(),
  }),
});

export const sendMessageSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  conversationId: z.string().optional().nullable(),
  message: z.string().min(1, 'Message cannot be empty'),
  attachments: z.array(fileAttachmentSchema).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type FileAttachment = z.infer<typeof fileAttachmentSchema>;
