import { prisma } from '../lib/prisma.js';

async function checkEmployees() {
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    include: {
      user: { select: { email: true } },
      department: { select: { name: true } },
      designation: { select: { title: true, level: true } }
    },
    orderBy: [
      { designation: { level: 'desc' } },
      { department: { name: 'asc' } },
      { firstName: 'asc' }
    ]
  });

  console.log('\n=== Current Employees ===\n');
  employees.forEach(emp => {
    console.log(`${emp.firstName} ${emp.lastName}`);
    console.log(`  Email: ${emp.user.email}`);
    console.log(`  Department: ${emp.department.name}`);
    console.log(`  Designation: ${emp.designation.title} (Level ${emp.designation.level})`);
    console.log(`  Manager ID: ${emp.managerId || 'NULL'}`);
    console.log('');
  });

  await prisma.$disconnect();
}

checkEmployees().catch(console.error);
