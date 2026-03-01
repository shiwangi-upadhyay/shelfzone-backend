import prisma from '../../lib/prisma.js';

interface PricingInfo {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheInputPricePerMillion: number;
}

const pricingCache = new Map<string, { data: PricingInfo; expiry: number }>();

export async function getModelPricing(model: string): Promise<PricingInfo> {
  const cached = pricingCache.get(model);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const row = await prisma.modelPricing.findUnique({ where: { modelName: model } });
  
  const pricing: PricingInfo = row
    ? {
        inputPricePerMillion: Number(row.inputPricePerMillion),
        outputPricePerMillion: Number(row.outputPricePerMillion),
        cacheInputPricePerMillion: Number(row.cacheInputPricePerMillion),
      }
    : { inputPricePerMillion: 3.0, outputPricePerMillion: 15.0, cacheInputPricePerMillion: 0.3 }; // default to Sonnet 4.5

  pricingCache.set(model, { data: pricing, expiry: Date.now() + 5 * 60 * 1000 }); // 5min cache
  return pricing;
}

/**
 * Calculate cost based on Anthropic's pricing model.
 * 
 * Anthropic's usage response includes:
 * - input_tokens: total input tokens (including cache hits + cache writes + regular input)
 * - cache_read_input_tokens: portion of input that was a cache hit
 * - cache_creation_input_tokens: portion of input that was written to cache
 * - output_tokens: output tokens
 * 
 * Correct formula:
 * - Regular input tokens = input_tokens - cache_read_input_tokens - cache_creation_input_tokens
 * - Cache read cost = cache_read_input_tokens * (cache price, typically 10% of input price)
 * - Cache write cost = cache_creation_input_tokens * (full input price, same as regular)
 * - Regular input cost = regular input tokens * input price
 * - Output cost = output_tokens * output price
 * 
 * Total = regular input cost + cache read cost + cache write cost + output cost
 */
export function calculateCost(
  pricing: PricingInfo,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheCreationTokens: number = 0,
): number {
  // Validate inputs
  if (inputTokens < 0 || outputTokens < 0 || cacheReadTokens < 0 || cacheCreationTokens < 0) {
    console.error('[BILLING ERROR] Negative token count:', { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens });
    // Clamp to 0
    inputTokens = Math.max(0, inputTokens);
    outputTokens = Math.max(0, outputTokens);
    cacheReadTokens = Math.max(0, cacheReadTokens);
    cacheCreationTokens = Math.max(0, cacheCreationTokens);
  }

  // Regular input tokens (non-cached)
  const regularInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheCreationTokens);

  // Calculate each component
  const regularInputCost = (regularInputTokens * pricing.inputPricePerMillion) / 1_000_000;
  const cacheReadCost = (cacheReadTokens * pricing.cacheInputPricePerMillion) / 1_000_000;
  const cacheWriteCost = (cacheCreationTokens * pricing.inputPricePerMillion) / 1_000_000; // cache write = full input price
  const outputCost = (outputTokens * pricing.outputPricePerMillion) / 1_000_000;

  const totalCost = regularInputCost + cacheReadCost + cacheWriteCost + outputCost;

  // Final validation: cost must be >= 0
  const finalCost = Math.max(0, totalCost);
  
  // Round to 4 decimal places
  return Math.round(finalCost * 10000) / 10000;
}
