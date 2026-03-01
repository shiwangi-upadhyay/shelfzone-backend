import { z } from 'zod';

// No body needed for these endpoints - all use auth user context
export const createGatewayKeySchema = z.object({});
export const regenerateGatewayKeySchema = z.object({});
export const testGatewayKeySchema = z.object({});
