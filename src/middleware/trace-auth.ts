import prisma from '../lib/prisma.js';

/**
 * Trace authorization helpers — service-level RLS for AgentTrace tables.
 * Owners see only their own data; SUPER_ADMIN bypasses; HR_ADMIN sees managed departments.
 */

export async function canAccessTrace(
  userId: string,
  role: string,
  traceId: string,
): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true;

  const trace = await prisma.taskTrace.findUnique({
    where: { id: traceId },
    select: { ownerId: true },
  });
  if (!trace) return false;

  if (trace.ownerId === userId) return true;

  if (role === 'HR_ADMIN') {
    return isInManagedDepartment(userId, trace.ownerId);
  }

  return false;
}

export async function canAccessSession(
  userId: string,
  role: string,
  sessionId: string,
): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true;

  const session = await prisma.traceSession.findUnique({
    where: { id: sessionId },
    select: { taskTrace: { select: { ownerId: true } } },
  });
  if (!session) return false;

  const ownerId = session.taskTrace.ownerId;
  if (ownerId === userId) return true;

  if (role === 'HR_ADMIN') {
    return isInManagedDepartment(userId, ownerId);
  }

  return false;
}

/**
 * Returns agent IDs the user is allowed to view traces for.
 * SUPER_ADMIN → all agents. HR_ADMIN → agents owned by managed-dept employees. Others → own agents only.
 */
export async function getAccessibleAgentIds(
  userId: string,
  role: string,
): Promise<string[]> {
  if (role === 'SUPER_ADMIN') {
    const agents = await prisma.agentRegistry.findMany({ select: { id: true } });
    return agents.map((a) => a.id);
  }

  const ownerIds = await getAccessibleOwnerIds(userId, role);
  const agents = await prisma.agentRegistry.findMany({
    where: { ownerId: { in: ownerIds } },
    select: { id: true },
  });
  return agents.map((a) => a.id);
}

/**
 * Build a Prisma `where` filter so list queries only return allowed traces.
 */
export async function traceWhereFilter(
  userId: string,
  role: string,
): Promise<{ ownerId?: string | { in: string[] } }> {
  if (role === 'SUPER_ADMIN') return {};

  const ownerIds = await getAccessibleOwnerIds(userId, role);
  if (ownerIds.length === 1) return { ownerId: ownerIds[0] };
  return { ownerId: { in: ownerIds } };
}

// ── internal helpers ──────────────────────────────────────────────────

async function getAccessibleOwnerIds(userId: string, role: string): Promise<string[]> {
  const ids = [userId];

  if (role === 'HR_ADMIN') {
    const managed = await getManagedDepartmentEmployeeIds(userId);
    for (const id of managed) {
      if (!ids.includes(id)) ids.push(id);
    }
  }

  return ids;
}

async function getManagedDepartmentEmployeeIds(hrAdminId: string): Promise<string[]> {
  // HR_ADMIN manages departments where they are the head or assigned manager.
  // We look up departments managed by this user, then find all employees in those departments.
  const managedDepts = await prisma.department.findMany({
    where: { headId: hrAdminId },
    select: { id: true },
  });

  if (managedDepts.length === 0) return [];

  const employees = await prisma.employee.findMany({
    where: { departmentId: { in: managedDepts.map((d) => d.id) } },
    select: { userId: true },
  });

  return employees.map((e) => e.userId).filter((id): id is string => id != null);
}

async function isInManagedDepartment(hrAdminId: string, targetUserId: string): Promise<boolean> {
  const employeeIds = await getManagedDepartmentEmployeeIds(hrAdminId);
  return employeeIds.includes(targetUserId);
}
