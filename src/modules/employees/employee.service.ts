import prisma from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { generateEmployeeCode } from '../../lib/employee-code.js';
import type { CreateEmployeeInput, UpdateEmployeeInput } from './employee.schemas.js';
import type { Prisma } from '@prisma/client';

interface RequestingUser {
  userId: string;
  email: string;
  role: string;
}

const employeeInclude = {
  user: { select: { id: true, email: true } },
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, title: true } },
  manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
} satisfies Prisma.EmployeeInclude;

function isAdmin(role: string) {
  return role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
}

function decryptPii(employee: Record<string, unknown>) {
  const result = { ...employee };
  if (result.encryptedAadhaar) result.aadhaar = decrypt(result.encryptedAadhaar as string);
  if (result.encryptedPan) result.pan = decrypt(result.encryptedPan as string);
  if (result.encryptedSalary) result.salary = decrypt(result.encryptedSalary as string);
  delete result.encryptedAadhaar;
  delete result.encryptedPan;
  delete result.encryptedSalary;
  return result;
}

function stripPii(employee: Record<string, unknown>) {
  const result = { ...employee };
  delete result.encryptedAadhaar;
  delete result.encryptedPan;
  delete result.encryptedSalary;
  return result;
}

export async function createEmployee(data: CreateEmployeeInput) {
  // Validate references
  const [user, department, designation] = await Promise.all([
    prisma.user.findUnique({ where: { id: data.userId } }),
    prisma.department.findUnique({ where: { id: data.departmentId } }),
    prisma.designation.findUnique({ where: { id: data.designationId } }),
  ]);

  if (!user) throw { statusCode: 404, error: 'Not Found', message: 'User not found' };
  if (!department) throw { statusCode: 404, error: 'Not Found', message: 'Department not found' };
  if (!designation) throw { statusCode: 404, error: 'Not Found', message: 'Designation not found' };

  // Check if user already has an employee record
  const existing = await prisma.employee.findUnique({ where: { userId: data.userId } });
  if (existing)
    throw {
      statusCode: 409,
      error: 'Conflict',
      message: 'User already has an employee record',
    };

  if (data.managerId) {
    const manager = await prisma.employee.findUnique({ where: { id: data.managerId } });
    if (!manager) throw { statusCode: 404, error: 'Not Found', message: 'Manager not found' };
  }

  const employeeCode = await generateEmployeeCode(prisma);

  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      userId: data.userId,
      departmentId: data.departmentId,
      designationId: data.designationId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      encryptedAadhaar: data.aadhaar ? encrypt(data.aadhaar) : undefined,
      encryptedPan: data.pan ? encrypt(data.pan) : undefined,
      encryptedSalary: data.salary ? encrypt(data.salary) : undefined,
      dateOfJoining: new Date(data.dateOfJoining),
      managerId: data.managerId,
    },
    include: employeeInclude,
  });

  return employee;
}

export async function getEmployeeById(id: string, requestingUser: RequestingUser) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: employeeInclude,
  });

  if (!employee) throw { statusCode: 404, error: 'Not Found', message: 'Employee not found' };

  // RBAC check
  if (!isAdmin(requestingUser.role)) {
    if (requestingUser.role === 'EMPLOYEE') {
      if (employee.userId !== requestingUser.userId) {
        throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
      }
    } else if (requestingUser.role === 'MANAGER') {
      // Manager can see self + direct reports
      const managerEmployee = await prisma.employee.findUnique({
        where: { userId: requestingUser.userId },
      });
      if (employee.userId !== requestingUser.userId && employee.managerId !== managerEmployee?.id) {
        throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
      }
    }
  }

  const plain = employee as unknown as Record<string, unknown>;
  return isAdmin(requestingUser.role) ? decryptPii(plain) : stripPii(plain);
}

export async function updateEmployee(
  id: string,
  data: UpdateEmployeeInput,
  requestingUser: RequestingUser,
) {
  if (!isAdmin(requestingUser.role)) {
    throw { statusCode: 403, error: 'Forbidden', message: 'Only admins can update employees' };
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw { statusCode: 404, error: 'Not Found', message: 'Employee not found' };

  if (data.departmentId) {
    const dept = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!dept) throw { statusCode: 404, error: 'Not Found', message: 'Department not found' };
  }
  if (data.designationId) {
    const desig = await prisma.designation.findUnique({ where: { id: data.designationId } });
    if (!desig) throw { statusCode: 404, error: 'Not Found', message: 'Designation not found' };
  }
  if (data.managerId) {
    const manager = await prisma.employee.findUnique({ where: { id: data.managerId } });
    if (!manager) throw { statusCode: 404, error: 'Not Found', message: 'Manager not found' };
  }

  const updateData: Prisma.EmployeeUpdateInput = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.departmentId !== undefined)
    updateData.department = { connect: { id: data.departmentId } };
  if (data.designationId !== undefined)
    updateData.designation = { connect: { id: data.designationId } };
  if (data.dateOfJoining !== undefined) updateData.dateOfJoining = new Date(data.dateOfJoining);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.managerId !== undefined)
    updateData.manager = data.managerId
      ? { connect: { id: data.managerId } }
      : { disconnect: true };

  // Re-encrypt PII if changed
  if (data.aadhaar !== undefined)
    updateData.encryptedAadhaar = data.aadhaar ? encrypt(data.aadhaar) : null;
  if (data.pan !== undefined) updateData.encryptedPan = data.pan ? encrypt(data.pan) : null;
  if (data.salary !== undefined)
    updateData.encryptedSalary = data.salary ? encrypt(data.salary) : null;

  const updated = await prisma.employee.update({
    where: { id },
    data: updateData,
    include: employeeInclude,
  });

  const plain = updated as unknown as Record<string, unknown>;
  return decryptPii(plain);
}

export async function deleteEmployee(id: string, requestingUser: RequestingUser) {
  if (!isAdmin(requestingUser.role)) {
    throw { statusCode: 403, error: 'Forbidden', message: 'Only admins can delete employees' };
  }

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) throw { statusCode: 404, error: 'Not Found', message: 'Employee not found' };

  const updated = await prisma.employee.update({
    where: { id },
    data: { status: 'TERMINATED', dateOfLeaving: new Date() },
    include: employeeInclude,
  });

  return stripPii(updated as unknown as Record<string, unknown>);
}

export async function getEmployees(
  query: {
    page: number;
    limit: number;
    search?: string;
    departmentId?: string;
    designationId?: string;
    status?: string;
    managerId?: string;
    sortBy: string;
    sortOrder: string;
  },
  requestingUser: RequestingUser,
) {
  const { page, limit, search, departmentId, designationId, status, managerId, sortBy, sortOrder } =
    query;

  const where: Prisma.EmployeeWhereInput = {};

  // RBAC filtering
  if (requestingUser.role === 'EMPLOYEE') {
    where.userId = requestingUser.userId;
  } else if (requestingUser.role === 'MANAGER') {
    const managerEmployee = await prisma.employee.findUnique({
      where: { userId: requestingUser.userId },
    });
    if (managerEmployee) {
      where.OR = [{ managerId: managerEmployee.id }, { userId: requestingUser.userId }];
    } else {
      where.userId = requestingUser.userId;
    }
  }
  // HR_ADMIN / SUPER_ADMIN see all

  // Filters
  if (departmentId) where.departmentId = departmentId;
  if (designationId) where.designationId = designationId;
  if (status) where.status = status as Prisma.EmployeeWhereInput['status'];
  if (managerId) where.managerId = managerId;

  // Search
  if (search) {
    const searchFilter: Prisma.EmployeeWhereInput[] = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];

    if (where.OR) {
      // Combine RBAC OR with search OR using AND
      where.AND = [{ OR: where.OR }, { OR: searchFilter }];
      delete where.OR;
    } else {
      where.OR = searchFilter;
    }
  }

  const orderBy: Prisma.EmployeeOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      include: {
        department: { select: { id: true, name: true } },
        designation: { select: { id: true, title: true } },
        user: { select: { id: true, email: true } },
      },
    }),
    prisma.employee.count({ where }),
  ]);

  // Strip PII from list responses
  const sanitized = data.map((emp) => stripPii(emp as unknown as Record<string, unknown>));

  return {
    data: sanitized,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
