import prisma from '../../lib/prisma.js';
import type { RegularizeInput, ListAttendanceQuery } from './attendance.schemas.js';
import type { Prisma, AttendanceStatus } from '@prisma/client';

interface RequestingUser {
  userId: string;
  email: string;
  role: string;
}

const LATE_THRESHOLD_HOUR = 10; // 10:00 AM
const STANDARD_HOURS = 8;
const HALF_DAY_THRESHOLD = 4;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

async function getEmployeeByUserId(userId: string) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    throw { statusCode: 404, error: 'Not Found', message: 'Employee profile not found' };
  }
  return employee;
}

export async function checkIn(employeeId: string, note?: string) {
  const today = startOfDay(new Date());

  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  });
  if (existing) {
    throw { statusCode: 409, error: 'Conflict', message: 'Already checked in today' };
  }

  const now = new Date();
  const status: AttendanceStatus = now.getUTCHours() >= LATE_THRESHOLD_HOUR ? 'LATE' : 'PRESENT';

  const record = await prisma.attendanceRecord.create({
    data: {
      employeeId,
      date: today,
      checkIn: now,
      checkInNote: note,
      status,
    },
  });

  return record;
}

export async function checkOut(employeeId: string, note?: string) {
  const today = startOfDay(new Date());

  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  });
  if (!record) {
    throw { statusCode: 404, error: 'Not Found', message: 'No check-in found for today' };
  }
  if (record.checkOut) {
    throw { statusCode: 409, error: 'Conflict', message: 'Already checked out today' };
  }

  const now = new Date();
  const hoursWorked =
    Math.round(((now.getTime() - record.checkIn.getTime()) / 3_600_000) * 100) / 100;
  const overtimeHours = Math.max(0, Math.round((hoursWorked - STANDARD_HOURS) * 100) / 100);

  let status: AttendanceStatus = record.status;
  if (hoursWorked < HALF_DAY_THRESHOLD) {
    status = 'HALF_DAY';
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      checkOut: now,
      checkOutNote: note,
      hoursWorked,
      overtimeHours,
      status,
    },
  });

  // Update monthly summary
  await updateMonthlySummary(employeeId, today.getUTCMonth() + 1, today.getUTCFullYear());

  return updated;
}

export async function regularizeAttendance(data: RegularizeInput, approverId: string) {
  const date = startOfDay(new Date(data.date));
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();

  // Verify employee exists
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } });
  if (!employee) {
    throw { statusCode: 404, error: 'Not Found', message: 'Employee not found' };
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: data.employeeId, date } },
    create: {
      employeeId: data.employeeId,
      date,
      checkIn: data.checkIn ? new Date(data.checkIn) : date,
      checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
      checkInNote: data.note,
      status: data.status,
      hoursWorked:
        data.checkIn && data.checkOut
          ? Math.round(
              ((new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / 3_600_000) *
                100,
            ) / 100
          : undefined,
      overtimeHours:
        data.checkIn && data.checkOut
          ? Math.max(
              0,
              Math.round(
                ((new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) /
                  3_600_000 -
                  STANDARD_HOURS) *
                  100,
              ) / 100,
            )
          : undefined,
      isRegularized: true,
      regularizedBy: approverId,
      regularizedAt: new Date(),
    },
    update: {
      checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
      checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
      checkInNote: data.note,
      status: data.status,
      hoursWorked:
        data.checkIn && data.checkOut
          ? Math.round(
              ((new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) / 3_600_000) *
                100,
            ) / 100
          : undefined,
      overtimeHours:
        data.checkIn && data.checkOut
          ? Math.max(
              0,
              Math.round(
                ((new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) /
                  3_600_000 -
                  STANDARD_HOURS) *
                  100,
              ) / 100,
            )
          : undefined,
      isRegularized: true,
      regularizedBy: approverId,
      regularizedAt: new Date(),
    },
  });

  await updateMonthlySummary(data.employeeId, month, year);

  return record;
}

export async function getAttendanceById(id: string) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!record) {
    throw { statusCode: 404, error: 'Not Found', message: 'Attendance record not found' };
  }
  return record;
}

export async function getAttendance(query: ListAttendanceQuery, user: RequestingUser) {
  const { page, limit, employeeId, startDate, endDate, status } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.AttendanceRecordWhereInput = {};

  // RBAC filtering
  if (user.role === 'EMPLOYEE') {
    const emp = await getEmployeeByUserId(user.userId);
    where.employeeId = emp.id;
  } else if (user.role === 'MANAGER') {
    const emp = await getEmployeeByUserId(user.userId);
    // Manager sees own + direct reports
    if (employeeId) {
      // Verify the requested employee is self or a direct report
      const directReports = await prisma.employee.findMany({
        where: { managerId: emp.id },
        select: { id: true },
      });
      const allowedIds = [emp.id, ...directReports.map((r) => r.id)];
      if (!allowedIds.includes(employeeId)) {
        throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
      }
      where.employeeId = employeeId;
    } else {
      const directReports = await prisma.employee.findMany({
        where: { managerId: emp.id },
        select: { id: true },
      });
      where.employeeId = { in: [emp.id, ...directReports.map((r) => r.id)] };
    }
  } else {
    // HR_ADMIN, SUPER_ADMIN — see all, optionally filter
    if (employeeId) where.employeeId = employeeId;
  }

  if (startDate) where.date = { ...(where.date as object), gte: startOfDay(new Date(startDate)) };
  if (endDate) where.date = { ...(where.date as object), lte: endOfDay(new Date(endDate)) };
  if (status) where.status = status;

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return {
    data: records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateMonthlySummary(employeeId: string, month: number, year: number) {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId,
      date: { gte: startDate, lte: endDate },
    },
  });

  const summary = {
    totalPresent: 0,
    totalAbsent: 0,
    totalHalfDays: 0,
    totalLate: 0,
    totalLeaves: 0,
    totalHolidays: 0,
    totalHoursWorked: 0,
    totalOvertimeHours: 0,
  };

  for (const r of records) {
    switch (r.status) {
      case 'PRESENT':
        summary.totalPresent++;
        break;
      case 'ABSENT':
        summary.totalAbsent++;
        break;
      case 'HALF_DAY':
        summary.totalHalfDays++;
        break;
      case 'LATE':
        summary.totalLate++;
        break;
      case 'ON_LEAVE':
        summary.totalLeaves++;
        break;
      case 'HOLIDAY':
        summary.totalHolidays++;
        break;
    }
    if (r.hoursWorked) summary.totalHoursWorked += r.hoursWorked;
    if (r.overtimeHours) summary.totalOvertimeHours += r.overtimeHours;
  }

  summary.totalHoursWorked = Math.round(summary.totalHoursWorked * 100) / 100;
  summary.totalOvertimeHours = Math.round(summary.totalOvertimeHours * 100) / 100;

  await prisma.attendanceSummary.upsert({
    where: { employeeId_month_year: { employeeId, month, year } },
    create: { employeeId, month, year, ...summary },
    update: summary,
  });
}
