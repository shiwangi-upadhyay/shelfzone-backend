import prisma from '../../../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import type { ListAuditLogsQuery } from './audit.schemas.js';

export async function getAuditLogs(query: ListAuditLogsQuery) {
  const { page, limit, action, resource, userId, from, to } = query;
  const where: Prisma.AuditLogWhereInput = {};

  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (userId) where.userId = userId;
  
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        userId: true,
        action: true,
        resource: true,
        resourceId: true,
        details: true,
        ipAddress: true,
        userAgent: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Transform data to match expected response shape
  const transformedData = await Promise.all(
    data.map(async (log) => {
      let user = null;
      if (log.userId) {
        const userRecord = await prisma.user.findUnique({
          where: { id: log.userId },
          select: { email: true },
        });
        user = userRecord ? { email: userRecord.email } : null;
      }

      return {
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        userId: log.userId,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        metadata: log.details || {},
        user,
      };
    })
  );

  return {
    data: transformedData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
