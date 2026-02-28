import { z } from 'zod';

export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['csv']).default('csv'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeSchema>;
export type ExportQuery = z.infer<typeof exportQuerySchema>;
