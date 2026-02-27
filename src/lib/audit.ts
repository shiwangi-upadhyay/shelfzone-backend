import { type Prisma } from '@prisma/client';
import prisma from './prisma.js';

export interface AuditParams {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Fire-and-forget audit log entry. Never throws, never blocks.
 */
export function logAudit(params: AuditParams): void {
  prisma.auditLog
    .create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? null,
        details: params.details ?? undefined,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
    .catch(() => {
      // Silently swallow — audit logging must never crash the app
    });
}
