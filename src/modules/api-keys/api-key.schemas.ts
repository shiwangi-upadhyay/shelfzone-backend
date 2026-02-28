import { z } from 'zod';

export const setApiKeySchema = z.object({
  apiKey: z.string().min(1),
  provider: z.string().optional().default('anthropic'),
});
