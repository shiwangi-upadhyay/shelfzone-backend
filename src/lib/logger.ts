/**
 * Simple logger utility
 * Uses console with timestamps
 */

const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (...args: any[]) => console.log(`[${getTimestamp()}] INFO:`, ...args),
  warn: (...args: any[]) => console.warn(`[${getTimestamp()}] WARN:`, ...args),
  error: (...args: any[]) => console.error(`[${getTimestamp()}] ERROR:`, ...args),
  debug: (...args: any[]) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${getTimestamp()}] DEBUG:`, ...args);
    }
  }
};
