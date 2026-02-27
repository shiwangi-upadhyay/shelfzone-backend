import type { PrismaClient } from '@prisma/client';

/**
 * Generates the next sequential employee code in format EMP-XXXXX.
 * Queries the highest existing code and increments by 1.
 */
export async function generateEmployeeCode(prisma: PrismaClient): Promise<string> {
  const lastEmployee = await prisma.employee.findFirst({
    orderBy: { employeeCode: 'desc' },
    select: { employeeCode: true },
  });

  let nextNumber = 1;

  if (lastEmployee) {
    const match = lastEmployee.employeeCode.match(/^EMP-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1]!, 10) + 1;
    }
  }

  return `EMP-${String(nextNumber).padStart(5, '0')}`;
}
