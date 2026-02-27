import prisma from '../../lib/prisma.js';
import { type AccessTokenPayload } from '../auth/auth.service.js';
import { AttendanceStatus, Role } from '@prisma/client';

// ── Helpers ──────────────────────────────────────────────────────────

/** Build an employee filter honouring RBAC: MANAGER sees own team, HR/SUPER see all or filtered dept. */
async function buildEmployeeWhere(
  departmentId: string | undefined,
  requestingUser: AccessTokenPayload,
) {
  const where: Record<string, unknown> = { status: 'ACTIVE' };

  if (requestingUser.role === Role.MANAGER) {
    // Find the manager's employee record to scope by their team
    const managerEmp = await prisma.employee.findUnique({
      where: { userId: requestingUser.userId },
      select: { id: true, departmentId: true },
    });
    if (!managerEmp) throw new Error('Manager employee record not found');
    where.managerId = managerEmp.id;
    // If departmentId supplied, intersect — but manager can only see own dept
    if (departmentId && departmentId !== managerEmp.departmentId) {
      throw new Error('Managers can only view reports for their own department');
    }
  } else {
    // HR_ADMIN / SUPER_ADMIN
    if (departmentId) where.departmentId = departmentId;
  }

  return where;
}

function summariseCounts(records: { status: AttendanceStatus }[]) {
  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    onLeave: 0,
    holiday: 0,
    weekend: 0,
    total: records.length,
  };
  for (const r of records) {
    switch (r.status) {
      case AttendanceStatus.PRESENT:
        summary.present++;
        break;
      case AttendanceStatus.ABSENT:
        summary.absent++;
        break;
      case AttendanceStatus.LATE:
        summary.late++;
        break;
      case AttendanceStatus.HALF_DAY:
        summary.halfDay++;
        break;
      case AttendanceStatus.ON_LEAVE:
        summary.onLeave++;
        break;
      case AttendanceStatus.HOLIDAY:
        summary.holiday++;
        break;
      case AttendanceStatus.WEEKEND:
        summary.weekend++;
        break;
    }
  }
  return summary;
}

// ── Daily Report ─────────────────────────────────────────────────────

export async function getDailyReport(
  date: string,
  departmentId: string | undefined,
  requestingUser: AccessTokenPayload,
) {
  const empWhere = await buildEmployeeWhere(departmentId, requestingUser);
  const targetDate = new Date(date);

  const employees = await prisma.employee.findMany({
    where: empWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });

  const employeeIds = employees.map((e) => e.id);

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employeeIds }, date: targetDate },
    select: {
      employeeId: true,
      status: true,
      checkIn: true,
      checkOut: true,
      hoursWorked: true,
    },
  });

  const attendanceMap = new Map(attendanceRecords.map((r) => [r.employeeId, r]));

  const records = employees.map((emp) => {
    const att = attendanceMap.get(emp.id);
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department.name,
      status: att?.status ?? AttendanceStatus.ABSENT,
      checkIn: att?.checkIn ?? null,
      checkOut: att?.checkOut ?? null,
      hoursWorked: att?.hoursWorked ?? null,
    };
  });

  const summary = summariseCounts(records.map((r) => ({ status: r.status })));

  return { date, summary, records };
}

// ── Weekly Report ────────────────────────────────────────────────────

export async function getWeeklyReport(
  startDate: string,
  departmentId: string | undefined,
  requestingUser: AccessTokenPayload,
) {
  const empWhere = await buildEmployeeWhere(departmentId, requestingUser);
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const employees = await prisma.employee.findMany({
    where: empWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });

  const employeeIds = employees.map((e) => e.id);

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: { in: employeeIds },
      date: { gte: start, lte: end },
    },
  });

  // Group by employee
  const byEmployee = new Map<string, typeof attendanceRecords>();
  for (const r of attendanceRecords) {
    const list = byEmployee.get(r.employeeId) ?? [];
    list.push(r);
    byEmployee.set(r.employeeId, list);
  }

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;

  const employeeSummaries = employees.map((emp) => {
    const recs = byEmployee.get(emp.id) ?? [];
    let present = 0,
      absent = 0,
      late = 0,
      hoursWorked = 0;
    for (const r of recs) {
      if (r.status === AttendanceStatus.PRESENT) present++;
      else if (r.status === AttendanceStatus.ABSENT) absent++;
      else if (r.status === AttendanceStatus.LATE) late++;
      hoursWorked += r.hoursWorked ?? 0;
    }
    totalPresent += present;
    totalAbsent += absent;
    totalLate += late;
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department.name,
      daysPresent: present,
      daysAbsent: absent,
      daysLate: late,
      totalHoursWorked: Math.round(hoursWorked * 100) / 100,
    };
  });

  return {
    startDate,
    endDate: end.toISOString().slice(0, 10),
    summary: {
      totalEmployees: employees.length,
      totalPresent,
      totalAbsent,
      totalLate,
    },
    employees: employeeSummaries,
  };
}

// ── Monthly Report ───────────────────────────────────────────────────

export async function getMonthlyReport(
  month: number,
  year: number,
  departmentId: string | undefined,
  employeeId: string | undefined,
  requestingUser: AccessTokenPayload,
) {
  const empWhere = await buildEmployeeWhere(departmentId, requestingUser);

  // Specific employee override
  if (employeeId) {
    // Verify the employee is visible to requesting user
    const emp = await prisma.employee.findFirst({
      where: { ...empWhere, id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        department: { select: { name: true } },
      },
    });
    if (!emp) throw new Error('Employee not found or not accessible');

    const summary = await prisma.attendanceSummary.findUnique({
      where: { employeeId_month_year: { employeeId, month, year } },
    });

    return {
      month,
      year,
      summary: summary
        ? {
            totalPresent: summary.totalPresent,
            totalAbsent: summary.totalAbsent,
            totalLate: summary.totalLate,
            totalHalfDays: summary.totalHalfDays,
            totalLeaves: summary.totalLeaves,
            totalHolidays: summary.totalHolidays,
            totalHoursWorked: summary.totalHoursWorked,
            totalOvertimeHours: summary.totalOvertimeHours,
          }
        : null,
      employees: [
        {
          employeeId: emp.id,
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          department: emp.department.name,
          ...(summary
            ? {
                totalPresent: summary.totalPresent,
                totalAbsent: summary.totalAbsent,
                totalLate: summary.totalLate,
                totalHalfDays: summary.totalHalfDays,
                totalLeaves: summary.totalLeaves,
                totalHoursWorked: summary.totalHoursWorked,
                totalOvertimeHours: summary.totalOvertimeHours,
              }
            : {}),
        },
      ],
    };
  }

  // All employees (department-filtered or all)
  const employees = await prisma.employee.findMany({
    where: empWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      department: { select: { name: true } },
    },
  });

  const employeeIds = employees.map((e) => e.id);

  const summaries = await prisma.attendanceSummary.findMany({
    where: { employeeId: { in: employeeIds }, month, year },
  });

  const summaryMap = new Map(summaries.map((s) => [s.employeeId, s]));

  let aggPresent = 0,
    aggAbsent = 0,
    aggLate = 0,
    aggHours = 0,
    aggOvertime = 0;

  const employeeResults = employees.map((emp) => {
    const s = summaryMap.get(emp.id);
    if (s) {
      aggPresent += s.totalPresent;
      aggAbsent += s.totalAbsent;
      aggLate += s.totalLate;
      aggHours += s.totalHoursWorked;
      aggOvertime += s.totalOvertimeHours;
    }
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department.name,
      totalPresent: s?.totalPresent ?? 0,
      totalAbsent: s?.totalAbsent ?? 0,
      totalLate: s?.totalLate ?? 0,
      totalHalfDays: s?.totalHalfDays ?? 0,
      totalLeaves: s?.totalLeaves ?? 0,
      totalHoursWorked: s?.totalHoursWorked ?? 0,
      totalOvertimeHours: s?.totalOvertimeHours ?? 0,
    };
  });

  return {
    month,
    year,
    summary: {
      totalEmployees: employees.length,
      totalPresent: aggPresent,
      totalAbsent: aggAbsent,
      totalLate: aggLate,
      totalHoursWorked: Math.round(aggHours * 100) / 100,
      totalOvertimeHours: Math.round(aggOvertime * 100) / 100,
    },
    employees: employeeResults,
  };
}
