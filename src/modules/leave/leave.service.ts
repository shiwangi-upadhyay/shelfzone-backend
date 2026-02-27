import prisma from '../../lib/prisma.js';
import type { ApplyLeaveInput, ReviewLeaveInput, ListLeavesQuery } from './leave.schemas.js';
import type { LeaveType, LeaveRequestStatus } from '@prisma/client';

interface RequestingUser {
  userId: string;
  email: string;
  role: string;
}

function calcBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

async function getEmployeeByUserId(userId: string) {
  const employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    throw { statusCode: 404, error: 'Not Found', message: 'Employee profile not found' };
  }
  return employee;
}

export async function applyLeave(employeeId: string, data: ApplyLeaveInput) {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (endDate < startDate) {
    throw { statusCode: 400, error: 'Bad Request', message: 'endDate must be >= startDate' };
  }

  const totalDays = data.isHalfDay ? 0.5 : calcBusinessDays(startDate, endDate);
  if (totalDays <= 0) {
    throw { statusCode: 400, error: 'Bad Request', message: 'No working days in selected range' };
  }

  // Check leave policy
  const policy = await prisma.leavePolicy.findUnique({
    where: { leaveType: data.leaveType as LeaveType },
  });
  if (!policy || !policy.isActive) {
    throw {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Leave policy not found or inactive for this leave type',
    };
  }

  // Check max consecutive days
  if (totalDays > policy.maxConsecutiveDays) {
    throw {
      statusCode: 400,
      error: 'Bad Request',
      message: `Exceeds maximum consecutive days (${policy.maxConsecutiveDays})`,
    };
  }

  // Check balance
  const year = startDate.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveType_year: {
        employeeId,
        leaveType: data.leaveType as LeaveType,
        year,
      },
    },
  });
  if (!balance || balance.remaining < totalDays) {
    throw {
      statusCode: 400,
      error: 'Bad Request',
      message: `Insufficient leave balance. Available: ${balance?.remaining ?? 0}, Requested: ${totalDays}`,
    };
  }

  // Check overlapping requests
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });
  if (overlap) {
    throw {
      statusCode: 409,
      error: 'Conflict',
      message: 'Overlapping leave request exists',
    };
  }

  return prisma.leaveRequest.create({
    data: {
      employeeId,
      leaveType: data.leaveType as LeaveType,
      startDate,
      endDate,
      totalDays,
      isHalfDay: data.isHalfDay ?? false,
      halfDayType: data.isHalfDay ? (data.halfDayType ?? null) : null,
      reason: data.reason,
      status: 'PENDING',
    },
  });
}

export async function reviewLeave(leaveId: string, reviewerId: string, data: ReviewLeaveInput) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { employee: true },
  });
  if (!leave) {
    throw { statusCode: 404, error: 'Not Found', message: 'Leave request not found' };
  }

  if (leave.status !== 'PENDING') {
    throw {
      statusCode: 400,
      error: 'Bad Request',
      message: `Cannot review a request with status ${leave.status}`,
    };
  }

  // Check reviewer authorization
  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
  if (!reviewer) {
    throw { statusCode: 404, error: 'Not Found', message: 'Reviewer not found' };
  }

  if (reviewer.role === 'MANAGER') {
    // Manager can only review their direct reports
    if (leave.employee.managerId !== null) {
      const managerEmployee = await prisma.employee.findUnique({
        where: { userId: reviewerId },
      });
      if (!managerEmployee || leave.employee.managerId !== managerEmployee.id) {
        throw {
          statusCode: 403,
          error: 'Forbidden',
          message: 'You can only review leave requests of your direct reports',
        };
      }
    } else {
      throw {
        statusCode: 403,
        error: 'Forbidden',
        message: 'You can only review leave requests of your direct reports',
      };
    }
  } else if (reviewer.role !== 'HR_ADMIN' && reviewer.role !== 'SUPER_ADMIN') {
    throw { statusCode: 403, error: 'Forbidden', message: 'Not authorized to review leaves' };
  }

  const status = data.status as LeaveRequestStatus;

  // If approved, deduct balance
  if (status === 'APPROVED') {
    const year = leave.startDate.getUTCFullYear();
    await prisma.leaveBalance.update({
      where: {
        employeeId_leaveType_year: {
          employeeId: leave.employeeId,
          leaveType: leave.leaveType,
          year,
        },
      },
      data: {
        used: { increment: leave.totalDays },
        remaining: { decrement: leave.totalDays },
      },
    });
  }

  return prisma.leaveRequest.update({
    where: { id: leaveId },
    data: {
      status,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote: data.reviewNote ?? null,
    },
  });
}

export async function cancelLeave(leaveId: string, requestingUserId: string) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { employee: true },
  });
  if (!leave) {
    throw { statusCode: 404, error: 'Not Found', message: 'Leave request not found' };
  }

  const requester = await prisma.user.findUnique({ where: { id: requestingUserId } });
  if (!requester) {
    throw { statusCode: 404, error: 'Not Found', message: 'User not found' };
  }

  const isOwner = leave.employee.userId === requestingUserId;
  const isHR = requester.role === 'HR_ADMIN' || requester.role === 'SUPER_ADMIN';

  if (isOwner) {
    if (leave.status !== 'PENDING') {
      throw {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Employees can only cancel PENDING requests',
      };
    }
  } else if (isHR) {
    if (leave.status !== 'PENDING' && leave.status !== 'APPROVED') {
      throw {
        statusCode: 400,
        error: 'Bad Request',
        message: 'HR can only cancel PENDING or APPROVED requests',
      };
    }
  } else {
    throw { statusCode: 403, error: 'Forbidden', message: 'Not authorized to cancel this leave' };
  }

  // If cancelling an APPROVED leave, refund balance
  if (leave.status === 'APPROVED') {
    const year = leave.startDate.getUTCFullYear();
    await prisma.leaveBalance.update({
      where: {
        employeeId_leaveType_year: {
          employeeId: leave.employeeId,
          leaveType: leave.leaveType,
          year,
        },
      },
      data: {
        used: { decrement: leave.totalDays },
        remaining: { increment: leave.totalDays },
      },
    });
  }

  return prisma.leaveRequest.update({
    where: { id: leaveId },
    data: { status: 'CANCELLED' },
  });
}

export async function getLeaveById(id: string, user: RequestingUser) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, userId: true, managerId: true },
      },
      reviewer: { select: { id: true, email: true } },
    },
  });
  if (!leave) {
    throw { statusCode: 404, error: 'Not Found', message: 'Leave request not found' };
  }

  // RBAC: employee sees own, manager sees team, HR/Super sees all
  if (user.role === 'EMPLOYEE' && leave.employee.userId !== user.userId) {
    throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
  }

  if (user.role === 'MANAGER') {
    const managerEmployee = await prisma.employee.findUnique({ where: { userId: user.userId } });
    if (leave.employee.userId !== user.userId && leave.employee.managerId !== managerEmployee?.id) {
      throw { statusCode: 403, error: 'Forbidden', message: 'Access denied' };
    }
  }

  return leave;
}

export async function getLeaves(query: ListLeavesQuery, user: RequestingUser) {
  const { page, limit, employeeId, leaveType, status, startDate, endDate } = query;
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (user.role === 'EMPLOYEE') {
    const emp = await getEmployeeByUserId(user.userId);
    where.employeeId = emp.id;
  } else if (user.role === 'MANAGER') {
    const managerEmp = await getEmployeeByUserId(user.userId);
    where.OR = [{ employeeId: managerEmp.id }, { employee: { managerId: managerEmp.id } }];
  }
  // HR_ADMIN / SUPER_ADMIN see all

  if (employeeId) where.employeeId = employeeId;
  if (leaveType) where.leaveType = leaveType;
  if (status) where.status = status;
  if (startDate) where.startDate = { gte: new Date(startDate) };
  if (endDate) where.endDate = { ...(where.endDate ?? {}), lte: new Date(endDate) };

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
