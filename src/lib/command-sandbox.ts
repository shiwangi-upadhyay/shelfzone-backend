/**
 * Command Sandboxing & Security
 * Implements allowlist, permission checks, and rate limiting
 */

import { logger } from './logger.js';
import { prisma } from './prisma.js';

// Rate limiting: 10 commands per minute per device
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_COMMANDS = 10;

// In-memory rate limit tracker
const rateLimitTracker = new Map<string, { count: number; windowStart: number }>();

/**
 * Allowed commands whitelist
 * Only these commands can be executed on nodes
 */
const ALLOWED_COMMANDS = new Set([
  'camera.snap',
  'camera.clip',
  'canvas.present',
  'canvas.navigate',
  'canvas.eval',
  'canvas.snapshot',
  'screen.record',
  'location.get',
  'system.run',
  'system.notify',
  'file.read',
  'file.write',
  'file.list'
]);

/**
 * Commands that require special permissions
 */
const PERMISSION_REQUIRED_COMMANDS: Record<string, string> = {
  'camera.snap': 'camera.capture',
  'camera.clip': 'camera.capture',
  'screen.record': 'screen.record',
  'location.get': 'location.access',
  'system.run': 'system.execute',
  'system.notify': 'notifications.send',
  'file.write': 'file.write',
  'file.read': 'file.read'
};

/**
 * Dangerous system commands that need extra validation
 */
const DANGEROUS_SYSTEM_COMMANDS = [
  'rm', 'rmdir', 'del', 'delete',
  'format', 'mkfs',
  'dd', 'fdisk', 'parted',
  'sudo', 'su',
  'chmod', 'chown',
  'kill', 'killall', 'pkill'
];

export interface CommandValidationResult {
  allowed: boolean;
  reason?: string;
  sanitizedCommand?: string;
}

export interface DevicePermissions {
  'camera.capture'?: boolean;
  'screen.record'?: boolean;
  'location.access'?: boolean;
  'system.execute'?: boolean;
  'notifications.send'?: boolean;
  'file.write'?: boolean;
  'file.read'?: boolean;
}

/**
 * Check if device has exceeded rate limit
 */
export function checkRateLimit(deviceId: string): boolean {
  const now = Date.now();
  const tracker = rateLimitTracker.get(deviceId);

  if (!tracker) {
    // First request from this device
    rateLimitTracker.set(deviceId, { count: 1, windowStart: now });
    return true;
  }

  // Check if we're in a new window
  if (now - tracker.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Reset window
    tracker.count = 1;
    tracker.windowStart = now;
    rateLimitTracker.set(deviceId, tracker);
    return true;
  }

  // Increment count
  tracker.count++;
  rateLimitTracker.set(deviceId, tracker);

  if (tracker.count > RATE_LIMIT_MAX_COMMANDS) {
    logger.warn(
      `⚠️ Rate limit exceeded for device ${deviceId}: ${tracker.count} commands in ${
        now - tracker.windowStart
      }ms`
    );
    return false;
  }

  return true;
}

/**
 * Validate command against allowlist
 */
export function isCommandAllowed(command: string): boolean {
  const allowed = ALLOWED_COMMANDS.has(command);
  
  if (!allowed) {
    logger.warn(`⚠️ Command not in allowlist: ${command}`);
  }
  
  return allowed;
}

/**
 * Check if device has required permission for command
 */
export function hasRequiredPermission(
  command: string,
  permissions: DevicePermissions
): boolean {
  const requiredPermission = PERMISSION_REQUIRED_COMMANDS[command];

  if (!requiredPermission) {
    // No special permission required
    return true;
  }

  const hasPermission = permissions[requiredPermission as keyof DevicePermissions] === true;

  if (!hasPermission) {
    logger.warn(`⚠️ Device lacks permission ${requiredPermission} for command ${command}`);
  }

  return hasPermission;
}

/**
 * Validate system.run command arguments for security
 */
export function validateSystemRunCommand(args: string[]): CommandValidationResult {
  if (!args || args.length === 0) {
    return {
      allowed: false,
      reason: 'Empty command not allowed'
    };
  }

  const command = args[0].toLowerCase();

  // Check for dangerous commands
  for (const dangerous of DANGEROUS_SYSTEM_COMMANDS) {
    if (command.includes(dangerous)) {
      logger.warn(`🚨 SECURITY: Blocked dangerous command: ${command}`);
      return {
        allowed: false,
        reason: `Dangerous command blocked: ${dangerous}`
      };
    }
  }

  // Check for shell injection patterns
  const injectionPatterns = [
    /[;&|`$()]/,  // Shell metacharacters
    /\.\./,       // Directory traversal
    /\$\{/,       // Variable expansion
    />\s*\/dev/, // Redirects to devices
    /curl.*\|/,   // Piped curl (common malware pattern)
    /wget.*\|/    // Piped wget
  ];

  const fullCommand = args.join(' ');
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(fullCommand)) {
      logger.warn(`🚨 SECURITY: Injection pattern detected: ${pattern.source}`);
      return {
        allowed: false,
        reason: 'Potential command injection detected'
      };
    }
  }

  // Sanitize command by removing potentially dangerous characters
  const sanitizedArgs = args.map(arg => {
    // Remove null bytes
    return arg.replace(/\0/g, '');
  });

  return {
    allowed: true,
    sanitizedCommand: sanitizedArgs.join(' ')
  };
}

/**
 * Validate file path for file operations
 */
export function validateFilePath(filePath: string): CommandValidationResult {
  // Block absolute paths outside allowed directories
  const ALLOWED_BASE_PATHS = [
    '/tmp',
    '/var/tmp',
    './workspace',
    '~/workspace'
  ];

  // Block directory traversal
  if (filePath.includes('..')) {
    return {
      allowed: false,
      reason: 'Directory traversal not allowed'
    };
  }

  // Block system paths
  const BLOCKED_PATHS = [
    '/etc',
    '/bin',
    '/sbin',
    '/usr/bin',
    '/usr/sbin',
    '/boot',
    '/sys',
    '/proc',
    '/dev',
    '/root',
    'C:\\Windows',
    'C:\\System32'
  ];

  for (const blocked of BLOCKED_PATHS) {
    if (filePath.startsWith(blocked)) {
      return {
        allowed: false,
        reason: `Access to system path ${blocked} not allowed`
      };
    }
  }

  return {
    allowed: true,
    sanitizedCommand: filePath
  };
}

/**
 * Main command validation function
 */
export async function validateCommand(
  command: string,
  params: any,
  deviceId: string,
  permissions: DevicePermissions
): Promise<CommandValidationResult> {
  // 1. Check rate limit
  if (!checkRateLimit(deviceId)) {
    return {
      allowed: false,
      reason: `Rate limit exceeded (max ${RATE_LIMIT_MAX_COMMANDS} commands per minute)`
    };
  }

  // 2. Check allowlist
  if (!isCommandAllowed(command)) {
    return {
      allowed: false,
      reason: `Command ${command} not in allowlist`
    };
  }

  // 3. Check permissions
  if (!hasRequiredPermission(command, permissions)) {
    const required = PERMISSION_REQUIRED_COMMANDS[command];
    return {
      allowed: false,
      reason: `Missing required permission: ${required}`
    };
  }

  // 4. Command-specific validation
  if (command === 'system.run' && params.command) {
    const sysValidation = validateSystemRunCommand(params.command);
    if (!sysValidation.allowed) {
      return sysValidation;
    }
  }

  if ((command === 'file.read' || command === 'file.write') && params.filePath) {
    const pathValidation = validateFilePath(params.filePath);
    if (!pathValidation.allowed) {
      return pathValidation;
    }
  }

  // 5. Log command for audit trail
  logger.info(`✅ Command validated: ${command} for device ${deviceId}`);

  return {
    allowed: true
  };
}

/**
 * Log security event to audit trail
 */
export async function logSecurityEvent(
  deviceId: string,
  nodeId: string,
  event: string,
  severity: 'info' | 'warning' | 'critical',
  details: any
): Promise<void> {
  logger.log(severity === 'critical' ? 'error' : severity, 
    `🔒 SECURITY [${severity.toUpperCase()}]: ${event}`,
    { deviceId, nodeId, details }
  );

  // Store in audit log
  try {
    await prisma.auditLog.create({
      data: {
        action: event,
        resource: 'device_command',
        resourceId: deviceId,
        details: {
          nodeId,
          severity,
          ...details
        }
      }
    });
  } catch (error) {
    logger.error('Failed to write security audit log:', error);
  }
}

/**
 * Clear rate limit for device (admin function)
 */
export function clearRateLimit(deviceId: string): void {
  rateLimitTracker.delete(deviceId);
  logger.info(`🔄 Rate limit cleared for device ${deviceId}`);
}

/**
 * Get rate limit status for device
 */
export function getRateLimitStatus(deviceId: string): { count: number; remaining: number; resetIn: number } | null {
  const tracker = rateLimitTracker.get(deviceId);
  
  if (!tracker) {
    return {
      count: 0,
      remaining: RATE_LIMIT_MAX_COMMANDS,
      resetIn: RATE_LIMIT_WINDOW_MS
    };
  }

  const now = Date.now();
  const elapsed = now - tracker.windowStart;
  const remaining = Math.max(0, RATE_LIMIT_MAX_COMMANDS - tracker.count);
  const resetIn = Math.max(0, RATE_LIMIT_WINDOW_MS - elapsed);

  return {
    count: tracker.count,
    remaining,
    resetIn
  };
}
