import { PrismaClient, LeaveType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shelfzone';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedLeaveBalances() {
  console.log('Creating leave balances for all employees...');

  const currentYear = new Date().getFullYear();

  // Get all employees
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true },
  });

  // Get all leave policies
  const policies = await prisma.leavePolicy.findMany({
    where: { isActive: true },
  });

  console.log(`Found ${employees.length} employees and ${policies.length} leave policies`);

  let created = 0;
  let skipped = 0;

  for (const employee of employees) {
    for (const policy of policies) {
      // Check if balance already exists
      const existing = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveType_year: {
            employeeId: employee.id,
            leaveType: policy.leaveType,
            year: currentYear,
          },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create balance
      await prisma.leaveBalance.create({
        data: {
          employeeId: employee.id,
          leaveType: policy.leaveType,
          year: currentYear,
          totalEntitled: policy.totalDaysPerYear,
          used: 0,
          carriedForward: 0,
          remaining: policy.totalDaysPerYear,
        },
      });

      created++;
      console.log(`✓ Created ${policy.leaveType} balance for ${employee.firstName} ${employee.lastName}`);
    }
  }

  console.log(`\nDone! Created ${created} balances, skipped ${skipped} existing.`);
}

seedLeaveBalances()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
