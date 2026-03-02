import { z } from 'zod';

/**
 * Schema for delegation tool use
 */
export const delegateToolUseSchema = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.literal('delegate'),
  input: z.object({
    agentName: z.enum(['BackendForge', 'UIcraft', 'DataArchitect', 'TestRunner', 'DocSmith']),
    instruction: z.string().min(10).max(5000),
    reason: z.string().min(5).max(500),
  }),
});

/**
 * Schema for delegation result
 */
export const delegationResultSchema = z.object({
  success: z.boolean(),
  agentName: z.string(),
  instruction: z.string(),
  result: z.string(),
  sessionId: z.string(),
  cost: z.number(),
  tokensUsed: z.object({
    input: z.number(),
    output: z.number(),
    total: z.number(),
  }),
  durationMs: z.number(),
});

export type DelegateToolUse = z.infer<typeof delegateToolUseSchema>;
export type DelegationResult = z.infer<typeof delegationResultSchema>;
