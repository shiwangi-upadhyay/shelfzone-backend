/**
 * Secret redaction for AgentTrace event content and metadata.
 * Strips API keys, JWTs, passwords, connection strings, private keys, and optionally emails.
 */

interface RedactionRule {
  pattern: RegExp;
  replacement: string;
}

const RULES: RedactionRule[] = [
  // Private key blocks (must be before generic patterns)
  {
    pattern: /-----BEGIN[A-Z\s]*PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]*PRIVATE KEY-----/g,
    replacement: '[REDACTED]',
  },
  // Bearer JWT tokens
  {
    pattern: /Bearer\s+eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
    replacement: 'Bearer [REDACTED]',
  },
  // Standalone JWT tokens (not preceded by Bearer)
  {
    pattern: /(?<!Bearer\s)eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g,
    replacement: '[REDACTED]',
  },
  // Connection strings: DATABASE_URL, REDIS_URL, etc.
  {
    pattern: /([A-Z_]*(?:URL|URI|DSN))\s*=\s*\S+/g,
    replacement: '$1=[REDACTED]',
  },
  // sk- / pk- API keys (OpenAI, Stripe, etc.)
  {
    pattern: /\b(sk|pk)-[A-Za-z0-9_-]{10,}\b/g,
    replacement: '[REDACTED]',
  },
  // password in key-value contexts (JSON-ish and env-var-ish)
  {
    pattern: /password\s*[:=]\s*"[^"]*"/gi,
    replacement: 'password: "[REDACTED]"',
  },
  {
    pattern: /password\s*[:=]\s*'[^']*'/gi,
    replacement: "password: '[REDACTED]'",
  },
  {
    pattern: /password\s*=\s*\S+/gi,
    replacement: 'password=[REDACTED]',
  },
  // secret / api_key / apikey / access_token generic patterns
  {
    pattern: /(secret|api_?key|access_?token|auth_?token)\s*[:=]\s*"[^"]*"/gi,
    replacement: '$1: "[REDACTED]"',
  },
  {
    pattern: /(secret|api_?key|access_?token|auth_?token)\s*[:=]\s*'[^']*'/gi,
    replacement: "$1: '[REDACTED]'",
  },
  {
    pattern: /(secret|api_?key|access_?token|auth_?token)\s*=\s*\S+/gi,
    replacement: '$1=[REDACTED]',
  },
];

const EMAIL_RULE: RedactionRule = {
  pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  replacement: '[EMAIL_REDACTED]',
};

/**
 * Redact secrets from a text string.
 */
export function redactContent(text: string, opts?: { redactEmails?: boolean }): string {
  let result = text;
  for (const rule of RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  if (opts?.redactEmails) {
    result = result.replace(EMAIL_RULE.pattern, EMAIL_RULE.replacement);
  }
  return result;
}

/**
 * Deep-clone an object and redact all string values.
 */
export function redactMetadata(
  obj: Record<string, unknown>,
  opts?: { redactEmails?: boolean },
): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'string') return redactContent(value, opts);
      return value;
    }),
  );
}
