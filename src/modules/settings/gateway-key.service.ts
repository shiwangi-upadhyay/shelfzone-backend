import { prisma } from '../../lib/prisma.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

/**
 * Generate a unique gateway key: shz-gw-{userId}-{randomString}
 */
function generateGatewayKey(userId: string): string {
  const randomPart = crypto.randomBytes(16).toString('hex');
  return `shz-gw-${userId}-${randomPart}`;
}

/**
 * Get key prefix for display (first 12 chars + "...")
 */
function getKeyPrefix(fullKey: string): string {
  return fullKey.substring(0, 12) + '...';
}

/**
 * Mask key for display: "shz-gw-...XXXX"
 */
function maskKey(fullKey: string): string {
  const lastFour = fullKey.slice(-4);
  return `shz-gw-...${lastFour}`;
}

/**
 * Create a new gateway key for the user
 */
export async function createGatewayKey(userId: string) {
  // Check if user already has a key
  const existingKey = await prisma.userGatewayKey.findUnique({
    where: { userId },
  });

  if (existingKey) {
    throw { 
      statusCode: 409, 
      error: 'Conflict', 
      message: 'Gateway key already exists. Use regenerate endpoint to create a new one.' 
    };
  }

  const fullKey = generateGatewayKey(userId);
  const keyHash = await bcrypt.hash(fullKey, SALT_ROUNDS);
  const keyPrefix = getKeyPrefix(fullKey);

  const record = await prisma.userGatewayKey.create({
    data: {
      userId,
      keyHash,
      keyPrefix,
      isActive: true,
    },
  });

  return {
    keyId: record.id,
    keyPrefix: record.keyPrefix,
    fullKey, // Only returned on creation
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * Get gateway key status (masked)
 */
export async function getGatewayKeyStatus(userId: string) {
  const key = await prisma.userGatewayKey.findUnique({
    where: { userId },
  });

  if (!key) {
    return { hasKey: false };
  }

  // Calculate connection status
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const isActive = key.lastUsedAt && key.lastUsedAt >= last24h;

  // Get today's usage stats (placeholder - would need a separate usage log table for accurate tracking)
  const callsToday = 0; // TODO: Implement usage tracking

  // Extract the prefix part before "..." and create masked version
  const prefixPart = key.keyPrefix.split('...')[0]; // e.g., "shz-gw-seed-"
  const maskedPrefix = `${prefixPart}...XXXX`;

  return {
    hasKey: true,
    keyPrefix: maskedPrefix,
    connectionStatus: isActive ? 'active' : 'inactive',
    lastSeen: key.lastUsedAt?.toISOString() || null,
    callsToday,
  };
}

/**
 * Regenerate gateway key (invalidate old, create new)
 */
export async function regenerateGatewayKey(userId: string) {
  const existingKey = await prisma.userGatewayKey.findUnique({
    where: { userId },
  });

  if (!existingKey) {
    throw { 
      statusCode: 404, 
      error: 'Not Found', 
      message: 'No gateway key found. Use create endpoint first.' 
    };
  }

  const fullKey = generateGatewayKey(userId);
  const keyHash = await bcrypt.hash(fullKey, SALT_ROUNDS);
  const keyPrefix = getKeyPrefix(fullKey);

  const record = await prisma.userGatewayKey.update({
    where: { userId },
    data: {
      keyHash,
      keyPrefix,
      isActive: true,
      lastUsedAt: null, // Reset usage timestamp
    },
  });

  return {
    keyId: record.id,
    keyPrefix: record.keyPrefix,
    fullKey, // Only returned on regeneration
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * Test gateway connection
 */
export async function testGatewayConnection(userId: string) {
  const key = await prisma.userGatewayKey.findUnique({
    where: { userId },
  });

  if (!key) {
    throw { 
      statusCode: 404, 
      error: 'Not Found', 
      message: 'No gateway key found' 
    };
  }

  if (!key.isActive) {
    return {
      success: false,
      latencyMs: 0,
      message: 'Gateway key is inactive',
    };
  }

  // Simulate a simple test (in production, this would make a real test call)
  const startTime = Date.now();
  
  // Update lastUsedAt to simulate usage
  await prisma.userGatewayKey.update({
    where: { userId },
    data: { lastUsedAt: new Date() },
  });

  const latencyMs = Date.now() - startTime;

  return {
    success: true,
    latencyMs,
    message: 'Gateway connection successful',
  };
}

/**
 * Verify a gateway key (used by gateway authentication middleware)
 */
export async function verifyGatewayKey(providedKey: string): Promise<{ valid: boolean; userId?: string }> {
  // Extract userId from key format: shz-gw-{userId}-{randomString}
  const parts = providedKey.split('-');
  if (parts.length < 4 || parts[0] !== 'shz' || parts[1] !== 'gw') {
    return { valid: false };
  }

  const userId = parts[2];

  const key = await prisma.userGatewayKey.findUnique({
    where: { userId },
  });

  if (!key || !key.isActive) {
    return { valid: false };
  }

  const isValid = await bcrypt.compare(providedKey, key.keyHash);

  if (isValid) {
    // Update lastUsedAt
    await prisma.userGatewayKey.update({
      where: { userId },
      data: { lastUsedAt: new Date() },
    });

    return { valid: true, userId };
  }

  return { valid: false };
}
