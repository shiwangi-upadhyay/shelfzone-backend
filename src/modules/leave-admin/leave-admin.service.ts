import { type LeaveType } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { logAudit, type AuditParams } from '../../lib/audit.js';

export async function initializeEmployeeBalances(employeeId: string, year: number) {
  const policies = await prisma.leavePolicy.findMany({ where: { isActive: true } });

  const created: Array<{ leaveType: LeaveType; totalEntitled: number }> = [];

  for (const policy of policies) {
    const exists = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveType_year: { employeeId, leaveType: policy.leaveType, year } },
    });
    if (exists) continue;

    await prisma.leaveBalance.create({
      data: {
        employeeId,
        leaveType: policy.leaveType,
        year,
        totalEntitled: policy.totalDaysPerYear,
        used: 0,
        carriedForward: 0,
        remaining: policy.totalDaysPerYear,
      },
    });
    created.push({ leaveType: policy.leaveType, totalEntitled: policy.totalDaysPerYear });
  }

  return created;
}

export async function initializeAllBalances(year: number) {
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  let totalCreated = 0;
  for (const emp of employees) {
    const created = await initializeEmployeeBalances(emp.id, year);
    totalCreated += created.length;
  }

  return { employeesProcessed: employees.length, balancesCreated: totalCreated };
}

export async function adjustBalance(
  employeeId: string,
  leaveType: LeaveType,
  year: number,
  adjustment: number,
  reason: string,
  audit: Omit<AuditParams, 'action' | 'resource'>,
) {
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveType_year: { employeeId, leaveType, year } },
  });

  if (!balance) {
    throw new Error(
      `No leave balance found for employee ${employeeId}, type ${leaveType}, year ${year}`,
    );
  }

  // Positive adjustment increases entitlement, negative increases used
  const updatedEntitled =
    adjustment > 0 ? balance.totalEntitled + adjustment : balance.totalEntitled;
  const updatedUsed = adjustment < 0 ? balance.used + Math.abs(adjustment) : balance.used;
  const updatedRemaining = updatedEntitled + balance.carriedForward - updatedUsed;

  const updated = await prisma.leaveBalance.update({
    where: { id: balance.id },
    data: {
      totalEntitled: updatedEntitled,
      used: updatedUsed,
      remaining: updatedRemaining,
    },
  });

  logAudit({
    ...audit,
    action: 'ADJUST_BALANCE',
    resource: 'LeaveBalance',
    resourceId: balance.id,
    details: { employeeId, leaveType, year, adjustment, reason, updatedRemaining },
  });

  return updated;
}

export async function getEmployeeBalances(employeeId: string, year?: number) {
  const targetYear = year ?? new Date().getFullYear();

  const balances = await prisma.leaveBalance.findMany({
    where: { employeeId, year: targetYear },
    orderBy: { leaveType: 'asc' },
  });

  // Attach policy name
  const policies = await prisma.leavePolicy.findMany();
  const policyMap = new Map(policies.map((p) => [p.leaveType, p.name]));

  return balances.map((b) => ({
    ...b,
    policyName: policyMap.get(b.leaveType) ?? b.leaveType,
  }));
}

export async function carryForwardBalances(
  year: number,
  audit: Omit<AuditParams, 'action' | 'resource'>,
) {
  const previousYear = year - 1;

  const policies = await prisma.leavePolicy.findMany({
    where: { isActive: true, canCarryForward: true },
  });
  if (policies.length === 0) return { carried: 0, details: [] };

  const policyMap = new Map(policies.map((p) => [p.leaveType, p]));

  const previousBalances = await prisma.leaveBalance.findMany({
    where: {
      year: previousYear,
      leaveType: { in: policies.map((p) => p.leaveType) },
    },
  });

  let carried = 0;
  const details: Array<{ employeeId: string; leaveType: LeaveType; amount: number }> = [];

  for (const prev of previousBalances) {
    const policy = policyMap.get(prev.leaveType);
    if (!policy || prev.remaining <= 0) continue;

    const carryAmount = Math.min(prev.remaining, policy.maxCarryForwardDays);
    if (carryAmount <= 0) continue;

    // Upsert the new year's balance
    const existing = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId: prev.employeeId,
          leaveType: prev.leaveType,
          year,
        },
      },
    });

    if (existing) {
      await prisma.leaveBalance.update({
        where: { id: existing.id },
        data: {
          carriedForward: carryAmount,
          remaining: existing.totalEntitled + carryAmount - existing.used,
        },
      });
    } else {
      await prisma.leaveBalance.create({
        data: {
          employeeId: prev.employeeId,
          leaveType: prev.leaveType,
          year,
          totalEntitled: policy.totalDaysPerYear,
          used: 0,
          carriedForward: carryAmount,
          remaining: policy.totalDaysPerYear + carryAmount,
        },
      });
    }

    carried++;
    details.push({
      employeeId: prev.employeeId,
      leaveType: prev.leaveType,
      amount: carryAmount,
    });
  }

  logAudit({
    ...audit,
    action: 'CARRY_FORWARD',
    resource: 'LeaveBalance',
    details: { year, totalCarried: carried, details },
  });

  return { carried, details };
}
