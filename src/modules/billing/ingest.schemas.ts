import { z } from 'zod';

export const ingestSessionSchema = z.object({
  // Task-level info (creates or finds TaskTrace)
  taskDescription: z.string().min(1).max(500),

  // Session-level info
  agentName: z.string().min(1),
  model: z.string().min(1),
  tokensIn: z.number().int().min(0),
  tokensOut: z.number().int().min(0),
  cost: z.number().min(0),
  durationMs: z.number().int().min(0).optional(),
  status: z.enum(['success', 'failed', 'running']).default('success'),
  sessionType: z.enum(['openclaw', 'command-center', 'external']).default('openclaw'),
  timestamp: z.string().datetime().optional(),
  instruction: z.string().max(1000).optional(),

  // Delegation chain
  delegatedByAgent: z.string().optional(), // agent name that delegated
  parentTaskDescription: z.string().optional(), // links to parent task

  // Sub-agents used in this session (batch ingest)
  subAgents: z.array(z.object({
    agentName: z.string().min(1),
    model: z.string().min(1),
    instruction: z.string().max(1000).optional(),
    tokensIn: z.number().int().min(0),
    tokensOut: z.number().int().min(0),
    cost: z.number().min(0),
    durationMs: z.number().int().min(0).optional(),
    status: z.enum(['success', 'failed', 'running']).default('success'),
  })).optional(),
});

export type IngestSessionInput = z.infer<typeof ingestSessionSchema>;
