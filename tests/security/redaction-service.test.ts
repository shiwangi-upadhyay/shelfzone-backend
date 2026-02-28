import { redactContent, redactMetadata } from '../../src/services/redaction-service.js';

describe('redactContent', () => {
  it('redacts Bearer JWT tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123_-';
    expect(redactContent(input)).toContain('Bearer [REDACTED]');
    expect(redactContent(input)).not.toContain('eyJ');
  });

  it('redacts standalone JWT tokens', () => {
    const input = 'token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123_-';
    expect(redactContent(input)).toContain('[REDACTED]');
    expect(redactContent(input)).not.toContain('eyJhbG');
  });

  it('redacts password values', () => {
    expect(redactContent('password: "s3cret!"')).toBe('password: "[REDACTED]"');
    expect(redactContent("password: 'hunter2'")).toBe("password: '[REDACTED]'");
    expect(redactContent('password=mysecret')).toBe('password=[REDACTED]');
  });

  it('redacts DATABASE_URL and connection strings', () => {
    const input = 'DATABASE_URL=postgresql://user:pass@host:5432/db';
    expect(redactContent(input)).toBe('DATABASE_URL=[REDACTED]');
  });

  it('redacts sk- and pk- API keys', () => {
    expect(redactContent('key: sk-abc123def456xyz')).toContain('[REDACTED]');
    expect(redactContent('pk-live_test1234567890')).toBe('[REDACTED]');
  });

  it('redacts private key blocks', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIE...data...\n-----END RSA PRIVATE KEY-----';
    expect(redactContent(pem)).toBe('[REDACTED]');
  });

  it('redacts generic secret/api_key patterns', () => {
    expect(redactContent('secret: "myvalue"')).toBe('secret: "[REDACTED]"');
    expect(redactContent('apikey=ABCDEF123')).toBe('apikey=[REDACTED]');
    expect(redactContent('access_token: "tok_xyz"')).toBe('access_token: "[REDACTED]"');
  });

  it('optionally redacts emails', () => {
    const input = 'contact: user@example.com';
    expect(redactContent(input)).toContain('user@example.com'); // default: no redaction
    expect(redactContent(input, { redactEmails: true })).toContain('[EMAIL_REDACTED]');
  });

  it('handles text with no secrets', () => {
    const clean = 'Hello world, this is a normal message.';
    expect(redactContent(clean)).toBe(clean);
  });
});

describe('redactMetadata', () => {
  it('redacts all string values in nested objects', () => {
    const obj = {
      token: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123_-',
      config: {
        db: 'DATABASE_URL=postgresql://u:p@h/d',
        count: 42,
      },
    };
    const result = redactMetadata(obj);
    expect(result.token).toContain('[REDACTED]');
    expect((result.config as any).db).toBe('DATABASE_URL=[REDACTED]');
    expect((result.config as any).count).toBe(42);
  });
});
