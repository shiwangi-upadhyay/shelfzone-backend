import { z } from 'zod';

export const createEmployeeSchema = z.object({
  userId: z.string().cuid(),
  departmentId: z.string().cuid(),
  designationId: z.string().cuid(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().max(20).trim().optional(),
  aadhaar: z.string().max(20).trim().optional(),
  pan: z.string().max(20).trim().optional(),
  salary: z.string().max(50).trim().optional(),
  dateOfJoining: z.string().datetime({ offset: true }).or(z.string().date()),
  managerId: z.string().cuid().optional(),
});

export const updateEmployeeSchema = z.object({
  departmentId: z.string().cuid().optional(),
  designationId: z.string().cuid().optional(),
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phone: z.string().max(20).trim().nullable().optional(),
  aadhaar: z.string().max(20).trim().nullable().optional(),
  pan: z.string().max(20).trim().nullable().optional(),
  salary: z.string().max(50).trim().nullable().optional(),
  dateOfJoining: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  managerId: z.string().cuid().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
});

export const getEmployeeParamsSchema = z.object({
  id: z.string().cuid(),
});

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).trim().optional(),
  departmentId: z.string().cuid().optional(),
  designationId: z.string().cuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
  managerId: z.string().cuid().optional(),
  sortBy: z
    .enum(['firstName', 'lastName', 'employeeCode', 'dateOfJoining', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
