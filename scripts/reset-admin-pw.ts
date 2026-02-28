import prisma from '../src/lib/prisma.js';
import argon2 from 'argon2';

async function main() {
  const hash = await argon2.hash('Admin@12345');
  await prisma.user.update({ where: { email: 'admin@shelfzone.com' }, data: { passwordHash: hash } });
  console.log('Admin password reset to Admin@12345');
  await prisma.$disconnect();
}
main();
