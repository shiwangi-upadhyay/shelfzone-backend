const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /ignore\s+(all\s+)?previous\s+instructions/i,
    reason: 'Prompt injection: ignore previous instructions',
  },
  { pattern: /you\s+are\s+now\s+/i, reason: 'Prompt injection: role-play override' },
  { pattern: /act\s+as\s+(a\s+)?/i, reason: 'Prompt injection: act-as attempt' },
  { pattern: /system\s*:\s*/i, reason: 'Prompt injection: system prompt override' },
  { pattern: /\[system\]/i, reason: 'Prompt injection: system tag' },
  { pattern: /<<\s*SYS\s*>>/i, reason: 'Prompt injection: SYS tag' },
  { pattern: /forget\s+(everything|all|your)\s/i, reason: 'Prompt injection: memory wipe' },
  { pattern: /new\s+instructions?\s*:/i, reason: 'Prompt injection: new instructions' },
  { pattern: /disregard\s+(all|any|the)\s/i, reason: 'Prompt injection: disregard attempt' },
  { pattern: /<script[\s>]/i, reason: 'HTML injection: script tag' },
  { pattern: /<iframe[\s>]/i, reason: 'HTML injection: iframe tag' },
  { pattern: /on(error|load|click|mouseover)\s*=/i, reason: 'HTML injection: event handler' },
  { pattern: /javascript\s*:/i, reason: 'JavaScript URI injection' },
];

const EXCESSIVE_SPECIAL_CHARS = /[^\w\s@.\-+,;:'"()\/\\]{10,}/;

/**
 * Validates input for suspicious patterns.
 */
export function validateInput(input: string): { safe: boolean; reason?: string } {
  for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      return { safe: false, reason };
    }
  }

  if (EXCESSIVE_SPECIAL_CHARS.test(input)) {
    return { safe: false, reason: 'Excessive special characters detected' };
  }

  return { safe: true };
}

/**
 * Sanitizes input by stripping/escaping dangerous patterns.
 */
export function sanitizeInput(input: string): string {
  let sanitized = input;

  // Strip HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Escape common injection delimiters
  sanitized = sanitized.replace(/[<>]/g, '');

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Trim excessive whitespace
  sanitized = sanitized.replace(/\s{3,}/g, '  ');

  return sanitized.trim();
}
