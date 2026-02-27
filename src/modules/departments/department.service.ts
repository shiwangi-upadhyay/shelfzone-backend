import prisma from '../../lib/prisma.js';
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  ListDepartmentsQuery,
} from './department.schemas.js';

export async function createDepartment(data: CreateDepartmentInput) {
  const existing = await prisma.department.findUnique({ where: { name: data.name } });
  if (existing) {
    throw { statusCode: 409, error: 'Conflict', message: 'Department name already exists' };
  }

  return prisma.department.create({
    data: {
      name: data.name,
      description: data.description,
      managerId: data.managerId,
    },
    include: { manager: { select: { id: true, email: true } } },
  });
}

export async function getDepartments(query: ListDepartmentsQuery) {
  const { page, limit, search, isActive } = query;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [data, total] = await Promise.all([
    prisma.department.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: { manager: { select: { id: true, email: true } } },
    }),
    prisma.department.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getDepartmentById(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: { manager: { select: { id: true, email: true } } },
  });

  if (!department) {
    throw { statusCode: 404, error: 'Not Found', message: 'Department not found' };
  }

  return department;
}

export async function updateDepartment(id: string, data: UpdateDepartmentInput) {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) {
    throw { statusCode: 404, error: 'Not Found', message: 'Department not found' };
  }

  if (data.name && data.name !== department.name) {
    const existing = await prisma.department.findUnique({ where: { name: data.name } });
    if (existing) {
      throw { statusCode: 409, error: 'Conflict', message: 'Department name already exists' };
    }
  }

  return prisma.department.update({
    where: { id },
    data,
    include: { manager: { select: { id: true, email: true } } },
  });
}

export async function deleteDepartment(id: string) {
  const department = await prisma.department.findUnique({
    where: { id },
    include: { employees: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 } },
  });

  if (!department) {
    throw { statusCode: 404, error: 'Not Found', message: 'Department not found' };
  }

  if (department.employees.length > 0) {
    throw {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Cannot delete department with active employees',
    };
  }

  return prisma.department.update({
    where: { id },
    data: { isActive: false },
  });
}
