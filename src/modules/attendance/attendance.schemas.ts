import { z } from 'zod';

export const checkInSchema = z.object({
  note: z.string().max(500).trim().optional(),
});

export const checkOutSchema = z.object({
  note: z.string().max(500).trim().optional(),
});

export const regularizeSchema = z.object({
  employeeId: z.string().cuid(),
  date: z.string().date(),
  status: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND']),
  checkIn: z.string().datetime({ offset: true }).optional(),
  checkOut: z.string().datetime({ offset: true }).optional(),
  note: z.string().max(500).trim().optional(),
});

export const getAttendanceParamsSchema = z.object({
  id: z.string().cuid(),
});

export const listAttendanceQuerySchema = z.object({
  employeeId: z.string().cuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z
    .enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type RegularizeInput = z.infer<typeof regularizeSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
