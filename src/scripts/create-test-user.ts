import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

async function main() {
  console.log('Creating test user...');

  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { email: 'test@test.com' },
  });

  if (existing) {
    console.log('✅ Test user already exists:', existing.email);
    return;
  }

  // Create test user
  const passwordHash = await bcrypt.hash('test123456', 10);
  const user = await prisma.user.create({
    data: {
      email: 'test@test.com',
      passwordHash,
      name: 'Test User',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Created test user:', user.email);
  console.log('   Password: test123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
