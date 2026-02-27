import prisma from '../../lib/prisma.js';
import type {
  CreateDesignationInput,
  UpdateDesignationInput,
  ListDesignationsQuery,
} from './designation.schemas.js';
import type { Prisma } from '@prisma/client';

export async function createDesignation(data: CreateDesignationInput) {
  const existing = await prisma.designation.findUnique({ where: { title: data.title } });
  if (existing) {
    return { error: 'DUPLICATE_TITLE' as const };
  }
  const designation = await prisma.designation.create({ data });
  return { data: designation };
}

export async function getDesignations(query: ListDesignationsQuery) {
  const { page, limit, search, isActive, level } = query;
  const where: Prisma.DesignationWhereInput = {};

  if (search) {
    where.title = { contains: search, mode: 'insensitive' };
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (level !== undefined) {
    where.level = level;
  }

  const [data, total] = await Promise.all([
    prisma.designation.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.designation.count({ where }),
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

export async function getDesignationById(id: string) {
  return prisma.designation.findUnique({ where: { id } });
}

export async function updateDesignation(id: string, data: UpdateDesignationInput) {
  const designation = await prisma.designation.findUnique({ where: { id } });
  if (!designation) {
    return { error: 'NOT_FOUND' as const };
  }

  if (data.title && data.title !== designation.title) {
    const existing = await prisma.designation.findUnique({ where: { title: data.title } });
    if (existing) {
      return { error: 'DUPLICATE_TITLE' as const };
    }
  }

  const updated = await prisma.designation.update({ where: { id }, data });
  return { data: updated };
}

export async function deleteDesignation(id: string) {
  const designation = await prisma.designation.findUnique({
    where: { id },
    include: { employees: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 } },
  });

  if (!designation) {
    return { error: 'NOT_FOUND' as const };
  }
  if (designation.employees.length > 0) {
    return { error: 'HAS_ACTIVE_EMPLOYEES' as const };
  }

  const updated = await prisma.designation.update({
    where: { id },
    data: { isActive: false },
  });
  return { data: updated };
}
