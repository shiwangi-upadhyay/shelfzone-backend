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

export const initializeBalancesSchema = z.object({
  employeeId: z.string().cuid(),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const initializeAllBalancesSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export const adjustBalanceSchema = z.object({
  employeeId: z.string().cuid(),
  leaveType: LeaveTypeEnum,
  year: z.coerce.number().int().min(2000).max(2100),
  adjustment: z.number(),
  reason: z.string().min(1).max(500).trim(),
});

export const getBalanceQuerySchema = z.object({
  employeeId: z.string().cuid(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const carryForwardSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
