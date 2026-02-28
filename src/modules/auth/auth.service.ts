import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { jwtConfig } from '../../config/jwt.js';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload {
  userId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

/**
 * Fast SHA-256 hash for high-entropy tokens (refresh tokens, API keys).
 * Argon2 is unnecessary here — these tokens are already cryptographically random.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyToken(token: string, storedHash: string): boolean {
  return hashToken(token) === storedHash;
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, jwtConfig.accessSecret, { expiresIn: jwtConfig.accessExpiresIn });
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, jwtConfig.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, jwtConfig.refreshSecret) as RefreshTokenPayload;
}

export async function register(email: string, password: string, role?: Role) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('EMAIL_EXISTS');
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: role ?? 'EMPLOYEE' },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken({ userId: user.id });

  // Store refresh token hash in DB (SHA-256 — token is already high-entropy)
  const refreshTokenHash = hashToken(refreshToken);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: refreshTokenHash },
  });

  const safeUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return { user: safeUser, accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive || !user.refreshToken) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Verify the refresh token against stored hash
  const valid = verifyToken(refreshToken, user.refreshToken);
  if (!valid) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  // Rotate tokens
  const newAccessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const newRefreshToken = generateRefreshToken({ userId: user.id });
  const newRefreshTokenHash = hashToken(newRefreshToken);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshTokenHash },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
}
