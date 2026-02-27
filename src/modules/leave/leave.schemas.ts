import { z } from 'zod';

const LeaveTypeEnum = z.enum([
  'CASUAL',
  'SICK',
  'EARNED',
  'MATERNITY',
  'PATERNITY',
  'COMPENSATORY',
  'UNPAID',
  'BEREAVEMENT',
]);

const LeaveRequestStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);

export const applyLeaveSchema = z.object({
  leaveType: LeaveTypeEnum,
  startDate: z.string().date(),
  endDate: z.string().date(),
  reason: z.string().min(1).max(1000).trim(),
  isHalfDay: z.boolean().optional().default(false),
  halfDayType: z.enum(['FIRST_HALF', 'SECOND_HALF']).optional(),
});

export const reviewLeaveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().max(500).trim().optional(),
});

export const leaveParamsSchema = z.object({
  id: z.string().cuid(),
});

export const listLeavesQuerySchema = z.object({
  employeeId: z.string().cuid().optional(),
  leaveType: LeaveTypeEnum.optional(),
  status: LeaveRequestStatusEnum.optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type ReviewLeaveInput = z.infer<typeof reviewLeaveSchema>;
export type ListLeavesQuery = z.infer<typeof listLeavesQuerySchema>;
