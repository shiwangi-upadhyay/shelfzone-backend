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
    : { inputPricePerMillion: 15.0, outputPricePerMillion: 75.0, cacheInputPricePerMillion: 1.875 }; // default to Opus

  pricingCache.set(model, { data: pricing, expiry: Date.now() + 5 * 60 * 1000 }); // 5min cache
  return pricing;
}

export function calculateCost(
  pricing: PricingInfo,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number = 0,
  cacheCreationTokens: number = 0,
): number {
  const newInputTokens = inputTokens - cacheReadTokens - cacheCreationTokens;
  const cost =
    (newInputTokens * pricing.inputPricePerMillion) / 1_000_000 +
    (cacheReadTokens * pricing.cacheInputPricePerMillion) / 1_000_000 +
    (cacheCreationTokens * pricing.inputPricePerMillion) / 1_000_000 + // cache creation charged at full input rate
    (outputTokens * pricing.outputPricePerMillion) / 1_000_000;
  return Math.round(cost * 10000) / 10000; // 4 decimal places
}
