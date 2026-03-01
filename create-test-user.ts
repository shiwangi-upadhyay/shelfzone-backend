import { prisma } from './src/lib/prisma.js';
import * as argon2 from 'argon2';

async function main() {
  const hashedPassword = await argon2.hash('Test123!');

  const user = await prisma.user.upsert({
    where: { email: 'agent@test.com' },
    update: {},
    create: {
      email: 'agent@test.com',
      passwordHash: hashedPassword,
      role: 'EMPLOYEE',
      isActive: true
    }
  });

  console.log('User created:', user.id, user.email);
  await prisma.$disconnect();
}

main().catch(console.error);
