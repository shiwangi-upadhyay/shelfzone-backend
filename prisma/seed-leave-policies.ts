import { PrismaClient, LeaveType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shelfzone';
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function seedLeavePolicies() {
  console.log('Seeding leave policies...');

  const policies = [
    {
      leaveType: LeaveType.CASUAL,
      name: 'Casual Leave',
      description: 'For personal reasons, short notice leave',
      totalDaysPerYear: 12,
      maxConsecutiveDays: 3,
      canCarryForward: true,
      maxCarryForwardDays: 5,
      isActive: true,
    },
    {
      leaveType: LeaveType.SICK,
      name: 'Sick Leave',
      description: 'For illness or medical appointments',
      totalDaysPerYear: 12,
      maxConsecutiveDays: 7,
      canCarryForward: false,
      maxCarryForwardDays: 0,
      isActive: true,
    },
    {
      leaveType: LeaveType.EARNED,
      name: 'Earned Leave',
      description: 'Accumulated leave for longer vacations',
      totalDaysPerYear: 15,
      maxConsecutiveDays: 15,
      canCarryForward: true,
      maxCarryForwardDays: 15,
      isActive: true,
    },
    {
      leaveType: LeaveType.MATERNITY,
      name: 'Maternity Leave',
      description: 'For new mothers',
      totalDaysPerYear: 180,
      maxConsecutiveDays: 180,
      canCarryForward: false,
      maxCarryForwardDays: 0,
      isActive: true,
    },
    {
      leaveType: LeaveType.PATERNITY,
      name: 'Paternity Leave',
      description: 'For new fathers',
      totalDaysPerYear: 15,
      maxConsecutiveDays: 15,
      canCarryForward: false,
      maxCarryForwardDays: 0,
      isActive: true,
    },
  ];

  for (const policy of policies) {
    await prisma.leavePolicy.upsert({
      where: { leaveType: policy.leaveType },
      update: policy,
      create: policy,
    });
    console.log(`✓ Created ${policy.name}`);
  }

  console.log('Leave policies seeded successfully!');
}

seedLeavePolicies()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
