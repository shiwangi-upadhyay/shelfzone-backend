import { type LeaveRequestStatus } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { decrypt } from '../../lib/encryption.js';
import type {
  UpdateProfileInput,
  GetMyPayslipsQuery,
  GetMyAttendanceQuery,
  GetMyLeavesQuery,
} from './self-service.schemas.js';

function tryDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

function decryptPayslipFields(payslip: Record<string, unknown>) {
  const fields = [
    'basicPay',
    'hra',
    'da',
    'specialAllowance',
    'medicalAllowance',
    'transportAllowance',
    'grossPay',
    'pfEmployee',
    'pfEmployer',
    'esiEmployee',
    'esiEmployer',
    'professionalTax',
    'tds',
    'otherDeductions',
    'totalDeductions',
    'netPay',
  ] as const;
  const result: Record<string, unknown> = { ...payslip };
  for (const f of fields) {
    if (result[f] && typeof result[f] === 'string') {
      result[f] = tryDecrypt(result[f] as string);
    }
  }
  return result;
}

export async function getMyProfile(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, title: true, level: true } },
      user: { select: { email: true, role: true } },
    },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee record not found'), { statusCode: 404 });
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [leaveBalances, attendanceSummary] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { employeeId: employee.id, year: currentYear },
    }),
    prisma.attendanceSummary.findFirst({
      where: { employeeId: employee.id, month: currentMonth, year: currentYear },
    }),
  ]);

  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    phone: employee.phone,
    email: employee.user.email,
    role: employee.user.role,
    department: employee.department,
    designation: employee.designation,
    dateOfJoining: employee.dateOfJoining,
    status: employee.status,
    aadhaar: tryDecrypt(employee.encryptedAadhaar),
    pan: tryDecrypt(employee.encryptedPan),
    salary: tryDecrypt(employee.encryptedSalary),
    leaveBalances: leaveBalances.map((lb) => ({
      leaveType: lb.leaveType,
      totalEntitled: lb.totalEntitled,
      used: lb.used,
      carriedForward: lb.carriedForward,
      remaining: lb.remaining,
    })),
    currentMonthAttendance: attendanceSummary
      ? {
          month: attendanceSummary.month,
          year: attendanceSummary.year,
          totalPresent: attendanceSummary.totalPresent,
          totalAbsent: attendanceSummary.totalAbsent,
          totalHalfDays: attendanceSummary.totalHalfDays,
          totalLate: attendanceSummary.totalLate,
          totalLeaves: attendanceSummary.totalLeaves,
          totalHoursWorked: attendanceSummary.totalHoursWorked,
        }
      : null,
  };
}

export async function updateMyProfile(userId: string, data: UpdateProfileInput) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee record not found'), { statusCode: 404 });
  }

  // Only update phone — emergencyContact and address are reserved for future schema fields
  const updateData: Record<string, string> = {};
  if (data.phone !== undefined) updateData.phone = data.phone;

  const updated = await prisma.employee.update({
    where: { id: employee.id },
    data: updateData,
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  });

  return updated;
}

export async function getMyPayslips(userId: string, query: GetMyPayslipsQuery) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee record not found'), { statusCode: 404 });
  }

  const where: Record<string, unknown> = { employeeId: employee.id };
  if (query.year) where.year = query.year;

  const [payslips, total] = await Promise.all([
    prisma.payslip.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.payslip.count({ where }),
  ]);

  return {
    data: payslips.map((p) => decryptPayslipFields(p as unknown as Record<string, unknown>)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getMyAttendance(userId: string, query: GetMyAttendanceQuery) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee record not found'), { statusCode: 404 });
  }

  const now = new Date();
  const year = query.year ?? now.getFullYear();
  const month = query.month ?? now.getMonth() + 1;

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // last day of month

  const [records, total, summary] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.attendanceRecord.count({
      where: {
        employeeId: employee.id,
        date: { gte: startDate, lte: endDate },
      },
    }),
    prisma.attendanceSummary.findFirst({
      where: { employeeId: employee.id, month, year },
    }),
  ]);

  return {
    data: records,
    summary: summary ?? null,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getMyLeaves(userId: string, query: GetMyLeavesQuery) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee record not found'), { statusCode: 404 });
  }

  const where: Record<string, unknown> = { employeeId: employee.id };
  if (query.status) where.status = query.status as LeaveRequestStatus;
  if (query.year) {
    const yearStart = new Date(query.year, 0, 1);
    const yearEnd = new Date(query.year, 11, 31);
    where.startDate = { gte: yearStart, lte: yearEnd };
  }

  const currentYear = new Date().getFullYear();

  const [requests, total, balances] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.leaveRequest.count({ where }),
    prisma.leaveBalance.findMany({
      where: { employeeId: employee.id, year: currentYear },
    }),
  ]);

  return {
    data: requests,
    balances: balances.map((lb) => ({
      leaveType: lb.leaveType,
      totalEntitled: lb.totalEntitled,
      used: lb.used,
      remaining: lb.remaining,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getMyDashboard(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!employee) {
    throw Object.assign(new Error('Employee record not found'), { statusCode: 404 });
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [todayAttendance, pendingLeaves, latestPayslip] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, date: todayStart },
    }),
    prisma.leaveRequest.count({
      where: { employeeId: employee.id, status: 'PENDING' },
    }),
    prisma.payslip.findFirst({
      where: { employeeId: employee.id },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      select: { month: true, year: true },
    }),
  ]);

  return {
    employee: {
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
    },
    todayAttendance: todayAttendance
      ? {
          status: todayAttendance.status,
          checkIn: todayAttendance.checkIn,
          checkOut: todayAttendance.checkOut,
          hoursWorked: todayAttendance.hoursWorked,
        }
      : null,
    pendingLeaveRequests: pendingLeaves,
    latestPayslip: latestPayslip ? { month: latestPayslip.month, year: latestPayslip.year } : null,
  };
}
