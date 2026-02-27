import { encrypt, decrypt } from '../../../src/lib/encryption.js';

describe('Encryption (AES-256-GCM)', () => {
  it('encrypts and decrypts a string round-trip', () => {
    const plain = 'Hello, ShelfZone!';
    const cipher = encrypt(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it('produces format iv:authTag:ciphertext', () => {
    const cipher = encrypt('test');
    const parts = cipher.split(':');
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars, authTag = 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(24);
    expect(parts[1]).toHaveLength(32);
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it('different encryptions of same plaintext produce different ciphertexts', () => {
    const a = encrypt('same');
    const b = encrypt('same');
    expect(a).not.toBe(b);
    // But both decrypt to same value
    expect(decrypt(a)).toBe('same');
    expect(decrypt(b)).toBe('same');
  });

  it('handles empty string', () => {
    const cipher = encrypt('');
    expect(decrypt(cipher)).toBe('');
  });

  it('throws on tampered ciphertext', () => {
    const cipher = encrypt('secret');
    const parts = cipher.split(':');
    // Tamper with encrypted data
    parts[2] = 'ff' + parts[2]!.slice(2);
    expect(() => decrypt(parts.join(':'))).toThrow();
  });

  it('throws on invalid format', () => {
    expect(() => decrypt('not-valid')).toThrow('Invalid ciphertext format');
  });
});
