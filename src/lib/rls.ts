import { PrismaClient } from '@prisma/client';

/**
 * Sets RLS context variables for the current transaction.
 * Must be called within a Prisma interactive transaction.
 */
export async function setRLSContext(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  userId: string,
  role: string,
): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId.replace(/'/g, "''")}'`);
  await tx.$executeRawUnsafe(`SET LOCAL app.current_user_role = '${role.replace(/'/g, "''")}'`);
}

/**
 * Execute a callback within an RLS-aware transaction.
 */
export async function withRLS<T>(
  prisma: PrismaClient,
  userId: string,
  role: string,
  fn: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setRLSContext(tx, userId, role);
    return fn(tx);
  });
}
