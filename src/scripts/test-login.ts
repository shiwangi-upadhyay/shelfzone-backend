import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

async function testLogin() {
  const email = 'admin@shelfzone.com';
  const password = 'test123456';

  console.log('Fetching user...');
  const user = await prisma.user.findUnique({ where: { email } });
  console.log('User found:', user ? { id: user.id, email: user.email, isActive: user.isActive, hashPreview: user.passwordHash.substring(0, 30) } : 'null');
  
  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('Verifying password...');
  const valid = await bcrypt.compare(password, user.passwordHash);
  console.log('Password valid:', valid);

  if (valid) {
    console.log('✅ Login would succeed!');
  } else {
    console.log('❌ Password mismatch');
    console.log('Expected hash:', user.passwordHash);
  }
}

testLogin()
  .catch(err => console.error('Error:', err))
  .finally(() => prisma.$disconnect());
