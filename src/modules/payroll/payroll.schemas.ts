import { z } from 'zod';

export const createSalaryStructureSchema = z.object({
  employeeId: z.string().cuid(),
  basicSalary: z.number().positive(),
  hra: z.number().nonnegative().optional(),
  da: z.number().nonnegative().optional(),
  specialAllowance: z.number().nonnegative().optional(),
  medicalAllowance: z.number().nonnegative().optional(),
  transportAllowance: z.number().nonnegative().optional(),
  effectiveFrom: z.string().date(),
});

export const updateSalaryStructureSchema = z.object({
  basicSalary: z.number().positive().optional(),
  hra: z.number().nonnegative().optional(),
  da: z.number().nonnegative().optional(),
  specialAllowance: z.number().nonnegative().optional(),
  medicalAllowance: z.number().nonnegative().optional(),
  transportAllowance: z.number().nonnegative().optional(),
  effectiveFrom: z.string().date().optional(),
});

export const salaryStructureParamsSchema = z.object({
  employeeId: z.string().cuid(),
});

export const createPayrollRunSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const processPayrollSchema = z.object({
  id: z.string().cuid(),
});

export const getPayslipParamsSchema = z.object({
  id: z.string().cuid(),
});

export const listPayslipsQuerySchema = z.object({
  employeeId: z.string().cuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;
export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>;
