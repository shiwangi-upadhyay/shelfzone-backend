interface EfficiencyStats {
  totalSessions: number;
  successCount: number;
  errorCount: number;
  totalCost: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  model: string;
}

const LATENCY_BENCHMARKS: Record<string, number> = {
  'claude-opus-4-6': 15000,
  'claude-sonnet-4-5': 8000,
  'claude-haiku-4-5': 3000,
};
const DEFAULT_LATENCY_BENCHMARK = 10000;

function normalize(value: number, min: number, max: number, invert = false): number {
  if (max <= min) return 50;
  const clamped = Math.max(min, Math.min(max, value));
  const score = ((clamped - min) / (max - min)) * 100;
  return invert ? 100 - score : score;
}

export function calculateEfficiencyScore(stats: EfficiencyStats): {
  score: number;
  breakdown: Record<string, number>;
} {
  const {
    totalSessions,
    successCount,
    errorCount,
    totalCost,
    avgLatencyMs,
    totalInputTokens,
    totalOutputTokens,
    model,
  } = stats;

  if (totalSessions === 0) {
    return {
      score: 0,
      breakdown: { tasksPerDollar: 0, latency: 0, successRate: 0, errorRate: 0, tokensPerTask: 0 },
    };
  }

  // Tasks per dollar (higher = better) — normalize 0-1000 range
  const tasksPerDollar = totalCost > 0 ? totalSessions / totalCost : totalSessions * 100;
  const tasksPerDollarScore = normalize(tasksPerDollar, 0, 1000);

  // Avg latency (lower = better) — benchmark against model
  const benchmark = LATENCY_BENCHMARKS[model] ?? DEFAULT_LATENCY_BENCHMARK;
  const latencyScore = normalize(avgLatencyMs, 0, benchmark * 2, true);

  // Success rate (higher = better)
  const successRate = (successCount / totalSessions) * 100;
  const successRateScore = normalize(successRate, 0, 100);

  // Error rate (lower = better)
  const errorRate = (errorCount / totalSessions) * 100;
  const errorRateScore = normalize(errorRate, 0, 50, true);

  // Tokens per task (lower = better)
  const tokensPerTask = (totalInputTokens + totalOutputTokens) / totalSessions;
  const tokensPerTaskScore = normalize(tokensPerTask, 0, 50000, true);

  const score = Math.round(
    tasksPerDollarScore * 0.25 +
      latencyScore * 0.2 +
      successRateScore * 0.25 +
      errorRateScore * 0.15 +
      tokensPerTaskScore * 0.15,
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      tasksPerDollar: Math.round(tasksPerDollarScore),
      latency: Math.round(latencyScore),
      successRate: Math.round(successRateScore),
      errorRate: Math.round(errorRateScore),
      tokensPerTask: Math.round(tokensPerTaskScore),
    },
  };
}
