import { z } from 'zod';

export const createTabSchema = z.object({
  title: z.string().min(1).max(100).optional().default('New Conversation'),
});

export const updateTabSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const tabIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreateTabInput = z.infer<typeof createTabSchema>;
export type UpdateTabInput = z.infer<typeof updateTabSchema>;
export type TabIdParam = z.infer<typeof tabIdParamSchema>;
