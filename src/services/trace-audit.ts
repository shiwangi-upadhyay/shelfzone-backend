import { logAudit } from '../lib/audit.js';

/**
 * Audit logging for AgentTrace operations.
 * Wraps the existing logAudit utility with trace-specific semantics.
 */

export function auditTraceView(params: {
  viewerId: string;
  viewerRole: string;
  traceOwnerId: string;
  traceId: string;
  ipAddress?: string;
  userAgent?: string;
}): void {
  // Only log cross-user views (SUPER_ADMIN viewing someone else's traces)
  if (params.viewerId === params.traceOwnerId) return;

  logAudit({
    userId: params.viewerId,
    action: 'TRACE_VIEW_OTHER',
    resource: 'task_traces',
    resourceId: params.traceId,
    details: {
      viewerRole: params.viewerRole,
      traceOwnerId: params.traceOwnerId,
    },
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}

export function auditTraceDelete(params: {
  userId: string;
  traceId: string;
  traceOwnerId: string;
  ipAddress?: string;
  userAgent?: string;
}): void {
  logAudit({
    userId: params.userId,
    action: 'TRACE_DELETE',
    resource: 'task_traces',
    resourceId: params.traceId,
    details: {
      traceOwnerId: params.traceOwnerId,
    },
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}

export function auditSSEConnect(params: {
  userId: string;
  traceId: string;
  ipAddress?: string;
}): void {
  logAudit({
    userId: params.userId,
    action: 'SSE_CONNECT',
    resource: 'task_traces',
    resourceId: params.traceId,
    ipAddress: params.ipAddress ?? null,
  });
}

export function auditSSEDisconnect(params: {
  userId: string;
  traceId: string;
  ipAddress?: string;
}): void {
  logAudit({
    userId: params.userId,
    action: 'SSE_DISCONNECT',
    resource: 'task_traces',
    resourceId: params.traceId,
    ipAddress: params.ipAddress ?? null,
  });
}
