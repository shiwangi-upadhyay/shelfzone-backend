import { z } from 'zod';

export const createDesignationSchema = z.object({
  title: z.string().min(1).max(100).trim(),
  level: z.number().int().min(1).max(5),
  description: z.string().max(500).trim().optional(),
});

export const updateDesignationSchema = z.object({
  title: z.string().min(1).max(100).trim().optional(),
  level: z.number().int().min(1).max(5).optional(),
  description: z.string().max(500).trim().nullable().optional(),
});

export const getDesignationParamsSchema = z.object({
  id: z.string().cuid(),
});

export const listDesignationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).trim().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  level: z.coerce.number().int().min(1).max(5).optional(),
});

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;
export type ListDesignationsQuery = z.infer<typeof listDesignationsQuerySchema>;
