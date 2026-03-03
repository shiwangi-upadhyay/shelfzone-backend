/**
 * Device Authentication & Token Management
 * Implements JWT-based device tokens with 30-day expiration
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from './logger.js';

// Default secret (should be overridden by env var in production)
const DEVICE_TOKEN_SECRET = process.env.DEVICE_TOKEN_SECRET || 'shelfzone-device-secret-change-in-production';
const TOKEN_EXPIRATION_DAYS = 30;

export interface DeviceTokenPayload {
  deviceId: string;
  nodeId: string;
  userId: string;
  role: 'node';
  scopes: string[];
  capabilities: string[];
  iat: number;
  exp: number;
}

export interface DeviceIdentity {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce: string;
}

/**
 * Generate a JWT device token for a paired device
 */
export function generateDeviceToken(
  deviceId: string,
  nodeId: string,
  userId: string,
  capabilities: string[] = []
): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = TOKEN_EXPIRATION_DAYS * 24 * 60 * 60; // 30 days in seconds

  const payload: DeviceTokenPayload = {
    deviceId,
    nodeId,
    userId,
    role: 'node',
    scopes: [],
    capabilities,
    iat: now,
    exp: now + expiresIn
  };

  const token = jwt.sign(payload, DEVICE_TOKEN_SECRET, {
    algorithm: 'HS256'
  });

  logger.info(`🔐 Generated device token for device ${deviceId}, expires in ${TOKEN_EXPIRATION_DAYS} days`);

  return token;
}

/**
 * Verify and decode a device token
 */
export function verifyDeviceToken(token: string): DeviceTokenPayload | null {
  try {
    const decoded = jwt.verify(token, DEVICE_TOKEN_SECRET, {
      algorithms: ['HS256']
    }) as DeviceTokenPayload;

    logger.debug(`✅ Device token verified for device ${decoded.deviceId}`);
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('⚠️ Device token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('⚠️ Invalid device token signature');
    } else {
      logger.error('❌ Device token verification error:', error);
    }
    return null;
  }
}

/**
 * Generate a challenge nonce for device pairing
 */
export function generateChallenge(): { nonce: string; timestamp: number } {
  const nonce = crypto.randomBytes(32).toString('base64');
  const timestamp = Date.now();

  logger.debug(`🎲 Generated challenge nonce: ${nonce.substring(0, 16)}...`);

  return { nonce, timestamp };
}

/**
 * Validate device signature against challenge nonce
 * 
 * MVP: Accept mock signature with TODO for Ed25519 implementation
 * 
 * TODO: Implement Ed25519 signature verification:
 * - Parse publicKey from base64
 * - Verify signature against nonce using Ed25519
 * - Reject if signature is invalid
 * - Add crypto library for Ed25519 (e.g., tweetnacl, noble-ed25519)
 */
export function validateDeviceSignature(
  deviceIdentity: DeviceIdentity,
  expectedNonce: string
): boolean {
  // MVP: Accept mock signatures for testing
  // In production, this should verify Ed25519 signature
  
  if (!deviceIdentity.signature || !deviceIdentity.publicKey) {
    logger.warn('⚠️ Missing signature or public key');
    return false;
  }

  // Check nonce matches
  if (deviceIdentity.nonce !== expectedNonce) {
    logger.warn(`⚠️ Nonce mismatch: expected ${expectedNonce}, got ${deviceIdentity.nonce}`);
    return false;
  }

  // Check signature timestamp is recent (within 5 minutes)
  const now = Date.now();
  const signatureAge = now - deviceIdentity.signedAt;
  const MAX_SIGNATURE_AGE = 5 * 60 * 1000; // 5 minutes

  if (signatureAge > MAX_SIGNATURE_AGE) {
    logger.warn(`⚠️ Signature too old: ${signatureAge}ms`);
    return false;
  }

  // MVP: Accept mock signatures (for testing)
  // TODO: Implement real Ed25519 verification
  if (deviceIdentity.signature === 'mock-signature-for-mvp') {
    logger.info('✅ Mock signature accepted (MVP mode)');
    return true;
  }

  // If not mock, reject for now (until Ed25519 is implemented)
  logger.warn('⚠️ Real Ed25519 signature validation not yet implemented - rejecting');
  logger.warn('TODO: Add Ed25519 signature verification library and implementation');
  
  // For MVP, we can be permissive and accept any signature
  // In production, this should return false
  logger.warn('⚠️ SECURITY WARNING: Accepting unverified signature in MVP mode');
  return true;
}

/**
 * Rotate device token (invalidate old, issue new)
 */
export function rotateDeviceToken(
  oldToken: string,
  deviceId: string,
  nodeId: string,
  userId: string,
  capabilities: string[] = []
): string | null {
  // Verify old token first
  const decoded = verifyDeviceToken(oldToken);
  
  if (!decoded) {
    logger.warn('⚠️ Cannot rotate: old token is invalid');
    return null;
  }

  // Check device ID matches
  if (decoded.deviceId !== deviceId) {
    logger.warn(`⚠️ Cannot rotate: device ID mismatch`);
    return null;
  }

  // Issue new token
  const newToken = generateDeviceToken(deviceId, nodeId, userId, capabilities);
  
  logger.info(`🔄 Device token rotated for device ${deviceId}`);
  
  return newToken;
}

/**
 * Check if device token is expiring soon (within 7 days)
 */
export function isTokenExpiringSoon(token: string): boolean {
  const decoded = verifyDeviceToken(token);
  
  if (!decoded) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = decoded.exp - now;
  const SEVEN_DAYS = 7 * 24 * 60 * 60;

  return timeUntilExpiry < SEVEN_DAYS && timeUntilExpiry > 0;
}
