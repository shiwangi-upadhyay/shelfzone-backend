const MODEL_RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 0.25, output: 1.25 },
};

const DEFAULT_RATE = { input: 3, output: 15 };

export function calculateSessionCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  const rate = MODEL_RATES[model] ?? DEFAULT_RATE;
  const inputCost = (inputTokens / 1_000_000) * rate.input;
  const outputCost = (outputTokens / 1_000_000) * rate.output;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

export function getModelRates() {
  return MODEL_RATES;
}
