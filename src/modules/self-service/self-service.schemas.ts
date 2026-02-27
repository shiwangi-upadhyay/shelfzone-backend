import { z } from 'zod';

const LeaveRequestStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);

export const updateProfileSchema = z.object({
  phone: z.string().min(1).max(20).trim().optional(),
  emergencyContact: z.string().min(1).max(100).trim().optional(),
  address: z.string().min(1).max(500).trim().optional(),
});

export const getMyPayslipsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const getMyAttendanceQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const getMyLeavesQuerySchema = z.object({
  status: LeaveRequestStatusEnum.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type GetMyPayslipsQuery = z.infer<typeof getMyPayslipsQuerySchema>;
export type GetMyAttendanceQuery = z.infer<typeof getMyAttendanceQuerySchema>;
export type GetMyLeavesQuery = z.infer<typeof getMyLeavesQuerySchema>;
