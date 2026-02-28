import { encrypt } from '../src/lib/encryption.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const apiKey = process.env.ADMIN_ANTHROPIC_KEY;
  if (!apiKey) { console.error('Set ADMIN_ANTHROPIC_KEY env var'); process.exit(1); }
  const encryptedKey = encrypt(apiKey);
  const keyPrefix = apiKey.substring(0, 10) + '...';

  const result = await prisma.userApiKey.upsert({
    where: { userId: 'seed-admin-001' },
    update: { encryptedKey, keyPrefix, provider: 'anthropic', isValid: true, lastVerified: new Date() },
    create: { userId: 'seed-admin-001', encryptedKey, keyPrefix, provider: 'anthropic', isValid: true, lastVerified: new Date() },
  });
  console.log('Seeded admin API key:', result.keyPrefix);
  await prisma.$disconnect();
}

main();
