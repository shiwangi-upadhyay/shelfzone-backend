import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../../src/modules/auth/auth.service.js';
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
} from '../../../src/modules/auth/auth.schemas.js';
import jwt from 'jsonwebtoken';

// ─── Password Hashing ───────────────────────────────────────────────

describe('Password Hashing', () => {
  it('should hash a password and verify it matches', async () => {
    const password = 'SecurePass123!';
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    const matches = await verifyPassword(password, hash);
    expect(matches).toBe(true);
  });

  it('should reject a wrong password', async () => {
    const hash = await hashPassword('CorrectPassword1');
    const matches = await verifyPassword('WrongPassword1', hash);
    expect(matches).toBe(false);
  });
});

// ─── JWT Access Token ───────────────────────────────────────────────

describe('JWT Access Token', () => {
  const payload = { userId: 'user-1', email: 'test@example.com', role: 'EMPLOYEE' as const };

  it('should generate and verify an access token with correct payload', () => {
    const token = generateAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
  });

  it('should throw on expired access token', () => {
    const token = jwt.sign(payload, process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me', { expiresIn: '0s' });
    expect(() => verifyAccessToken(token)).toThrow();
  });
});

// ─── JWT Refresh Token ──────────────────────────────────────────────

describe('JWT Refresh Token', () => {
  const payload = { userId: 'user-1' };

  it('should generate and verify a refresh token with correct payload', () => {
    const token = generateRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  it('should throw on expired refresh token', () => {
    const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me', { expiresIn: '0s' });
    expect(() => verifyRefreshToken(token)).toThrow();
  });
});

// ─── Zod Schemas ────────────────────────────────────────────────────

describe('Zod Schemas', () => {
  describe('RegisterSchema', () => {
    it('should validate correct input', () => {
      const result = RegisterSchema.safeParse({ email: 'a@b.com', password: '12345678' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = RegisterSchema.safeParse({ email: 'not-email', password: '12345678' });
      expect(result.success).toBe(false);
    });

    it('should reject short password (<8 chars)', () => {
      const result = RegisterSchema.safeParse({ email: 'a@b.com', password: '1234567' });
      expect(result.success).toBe(false);
    });
  });

  describe('LoginSchema', () => {
    it('should validate correct input', () => {
      const result = LoginSchema.safeParse({ email: 'a@b.com', password: 'x' });
      expect(result.success).toBe(true);
    });
  });

  describe('RefreshSchema', () => {
    it('should validate with refreshToken', () => {
      const result = RefreshSchema.safeParse({ refreshToken: 'some-token' });
      expect(result.success).toBe(true);
    });

    it('should validate without refreshToken (optional)', () => {
      const result = RefreshSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
