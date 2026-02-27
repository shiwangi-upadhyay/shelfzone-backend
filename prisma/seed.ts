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
