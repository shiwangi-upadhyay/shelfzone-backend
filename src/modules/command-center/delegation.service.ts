import { prisma } from '../../lib/prisma.js';
import { getAgentConfig } from './agents-config.js';
import { DelegationResult } from './delegation.schemas.js';
import { Prisma } from '@prisma/client';

// Cost rates per million tokens
const COST_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const safeInputTokens = Math.max(0, inputTokens || 0);
  const safeOutputTokens = Math.max(0, outputTokens || 0);

  const rateKey = Object.keys(COST_RATES).find((k) => model.includes(k)) || 'claude-sonnet-4-5';
  const rates = COST_RATES[rateKey];
  const inputCost = (safeInputTokens / 1_000_000) * rates.input;
  const outputCost = (safeOutputTokens / 1_000_000) * rates.output;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: Math.max(0, inputCost),
    outputCost: Math.max(0, outputCost),
    totalCost: Math.max(0, totalCost),
  };
}

export class DelegationService {
  constructor(
    private anthropicApiKey: string,
    private userId: string,
    private parentSessionId: string | null = null
  ) {}

  /**
   * Delegate a task to a sub-agent via REAL Anthropic API call
   */
  async delegateToAgent(
    agentName: string,
    instruction: string,
    reason: string
  ): Promise<DelegationResult> {
    const startedAt = new Date();

    // 1. Get agent configuration
    const agentConfig = getAgentConfig(agentName);
    if (!agentConfig) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    // 2. Find or create agent registry entry
    let agent = await prisma.agentRegistry.findFirst({
      where: { name: agentName },
    });

    if (!agent) {
      // Create agent entry if it doesn't exist
      agent = await prisma.agentRegistry.create({
        data: {
          name: agentName,
          slug: agentName.toLowerCase(),
          type: 'INTEGRATION',
          status: 'ACTIVE',
          model: agentConfig.model,
          systemPrompt: agentConfig.systemPrompt,
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.maxTokens,
          createdBy: this.userId,
        },
      });
    }

    // 3. Create task trace first if no parent
    const taskTraceId = this.parentSessionId || (await prisma.taskTrace.create({
      data: {
        ownerId: this.userId,
        masterAgentId: agent.id,
        instruction,
        status: 'running',
        startedAt,
      },
    })).id;

    // 4. Create trace session for this delegation
    const traceSession = await prisma.traceSession.create({
      data: {
        taskTraceId,
        agentId: agent.id,
        instruction,
        status: 'running',
        modelUsed: agentConfig.model,
        sessionType: 'delegation',
        startedAt,
      },
    });

    try {
      // 4. Make REAL Anthropic API call
      const requestBody = {
        model: agentConfig.model,
        max_tokens: agentConfig.maxTokens,
        temperature: agentConfig.temperature,
        system: agentConfig.systemPrompt,
        messages: [
          {
            role: 'user',
            content: instruction,
          },
        ],
      };

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!anthropicRes.ok) {
        const errorBody = await anthropicRes.text();
        throw new Error(`Anthropic API error: ${errorBody}`);
      }

      const response = await anthropicRes.json();

      // 5. Extract response and usage
      const result = response.content?.[0]?.text || '';
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      const totalTokens = inputTokens + outputTokens;

      // 6. Calculate cost
      const cost = calculateCost(agentConfig.model, inputTokens, outputTokens);

      // 7. Update trace session with results
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await prisma.traceSession.update({
        where: { id: traceSession.id },
        data: {
          status: 'success',
          cost: new Prisma.Decimal(cost.totalCost.toFixed(6)),
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          durationMs,
          completedAt,
        },
      });

      // 8. Return delegation result
      return {
        success: true,
        agentName,
        instruction,
        result,
        sessionId: traceSession.id,
        cost: cost.totalCost,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens,
        },
        durationMs,
      };
    } catch (error: any) {
      // Log failure
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await prisma.traceSession.update({
        where: { id: traceSession.id },
        data: {
          status: 'failed',
          completedAt,
          durationMs,
        },
      });

      throw error;
    }
  }
}
