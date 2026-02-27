import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding departments and designations...');

  const departments = [
    { name: 'Engineering', description: 'Software development and technical operations' },
    { name: 'HR', description: 'Human resources and people operations' },
    { name: 'Finance', description: 'Financial planning, accounting, and compliance' },
    { name: 'Marketing', description: 'Brand, growth, and communications' },
    { name: 'Operations', description: 'Business operations and logistics' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
  }
  console.log(`✅ Seeded ${departments.length} departments`);

  const designations = [
    { title: 'Junior Engineer', level: 1, description: 'Entry-level engineering role' },
    { title: 'Software Engineer', level: 2, description: 'Mid-level engineering role' },
    { title: 'Senior Engineer', level: 3, description: 'Senior engineering role' },
    { title: 'Team Lead', level: 4, description: 'Team leadership role' },
    { title: 'Engineering Manager', level: 5, description: 'Engineering management and executive role' },
    { title: 'HR Executive', level: 1, description: 'Entry-level HR role' },
    { title: 'HR Manager', level: 4, description: 'HR team leadership role' },
    { title: 'Finance Analyst', level: 2, description: 'Mid-level finance role' },
    { title: 'Finance Manager', level: 4, description: 'Finance team leadership role' },
    { title: 'Marketing Executive', level: 1, description: 'Entry-level marketing role' },
    { title: 'Operations Manager', level: 4, description: 'Operations leadership role' },
  ];

  for (const desig of designations) {
    await prisma.designation.upsert({
      where: { title: desig.title },
      update: {},
      create: desig,
    });
  }
  console.log(`✅ Seeded ${designations.length} designations`);

  // Seed leave policies
  console.log('🌱 Seeding leave policies...');

  const leavePolicies = [
    { leaveType: 'CASUAL' as const, name: 'Casual Leave', description: 'For personal/short-term needs', totalDaysPerYear: 12, maxConsecutiveDays: 3, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'SICK' as const, name: 'Sick Leave', description: 'For illness or medical needs', totalDaysPerYear: 12, maxConsecutiveDays: 7, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'EARNED' as const, name: 'Earned Leave', description: 'Privilege/earned leave accrued over service', totalDaysPerYear: 15, maxConsecutiveDays: 5, canCarryForward: true, maxCarryForwardDays: 30 },
    { leaveType: 'MATERNITY' as const, name: 'Maternity Leave', description: 'Maternity leave as per statutory requirements', totalDaysPerYear: 182, maxConsecutiveDays: 182, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'PATERNITY' as const, name: 'Paternity Leave', description: 'Paternity leave for new fathers', totalDaysPerYear: 15, maxConsecutiveDays: 15, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'COMPENSATORY' as const, name: 'Compensatory Off', description: 'Granted for working on holidays/weekends', totalDaysPerYear: 0, maxConsecutiveDays: 3, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'UNPAID' as const, name: 'Unpaid Leave', description: 'Leave without pay', totalDaysPerYear: 365, maxConsecutiveDays: 30, canCarryForward: false, maxCarryForwardDays: 0 },
    { leaveType: 'BEREAVEMENT' as const, name: 'Bereavement Leave', description: 'For death of immediate family member', totalDaysPerYear: 5, maxConsecutiveDays: 5, canCarryForward: false, maxCarryForwardDays: 0 },
  ];

  for (const policy of leavePolicies) {
    await prisma.leavePolicy.upsert({
      where: { leaveType: policy.leaveType },
      update: {},
      create: policy,
    });
  }
  console.log(`✅ Seeded ${leavePolicies.length} leave policies`);

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
