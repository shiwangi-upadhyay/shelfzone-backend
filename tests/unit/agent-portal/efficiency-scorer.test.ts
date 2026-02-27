import { calculateEfficiencyScore } from '../../../src/lib/efficiency-scorer.js';

describe('calculateEfficiencyScore()', () => {
  describe('Perfect stats', () => {
    it('returns score near 100 for perfect performance', () => {
      const stats = {
        totalSessions: 1000,
        successCount: 1000,
        errorCount: 0,
        totalCost: 1, // 1000 tasks per dollar
        avgLatencyMs: 1000, // Very fast
        totalInputTokens: 100_000,
        totalOutputTokens: 100_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.score).toBeGreaterThanOrEqual(90);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Terrible stats', () => {
    it('returns score near 0 for terrible performance', () => {
      const stats = {
        totalSessions: 100,
        successCount: 0,
        errorCount: 100,
        totalCost: 1000, // 0.1 tasks per dollar
        avgLatencyMs: 60000, // Very slow (60s)
        totalInputTokens: 10_000_000,
        totalOutputTokens: 10_000_000,
        model: 'claude-opus-4-6',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(20);
    });
  });

  describe('Mixed stats', () => {
    it('returns reasonable score for mixed performance', () => {
      const stats = {
        totalSessions: 500,
        successCount: 400,
        errorCount: 50,
        totalCost: 10, // 50 tasks per dollar
        avgLatencyMs: 8000, // At benchmark for Sonnet
        totalInputTokens: 5_000_000,
        totalOutputTokens: 5_000_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.score).toBeGreaterThan(30);
      expect(result.score).toBeLessThan(80);
    });
  });

  describe('Factor contributions', () => {
    it('verifies tasks per dollar weight (25%)', () => {
      const baseStats = {
        totalSessions: 1000,
        successCount: 1000,
        errorCount: 0,
        totalCost: 1, // Excellent efficiency
        avgLatencyMs: 8000,
        totalInputTokens: 1_000_000,
        totalOutputTokens: 1_000_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(baseStats);
      expect(result.breakdown.tasksPerDollar).toBeGreaterThan(90);
    });

    it('verifies latency weight (20%)', () => {
      const fastStats = {
        totalSessions: 1000,
        successCount: 1000,
        errorCount: 0,
        totalCost: 100, // Poor cost efficiency
        avgLatencyMs: 1000, // Very fast
        totalInputTokens: 10_000_000,
        totalOutputTokens: 10_000_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(fastStats);
      expect(result.breakdown.latency).toBeGreaterThan(85);
    });

    it('verifies success rate weight (25%)', () => {
      const highSuccessStats = {
        totalSessions: 1000,
        successCount: 950,
        errorCount: 50,
        totalCost: 100,
        avgLatencyMs: 10000,
        totalInputTokens: 10_000_000,
        totalOutputTokens: 10_000_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(highSuccessStats);
      expect(result.breakdown.successRate).toBeGreaterThanOrEqual(90);
    });

    it('verifies error rate weight (15%)', () => {
      const lowErrorStats = {
        totalSessions: 1000,
        successCount: 500,
        errorCount: 10, // 1% error rate
        totalCost: 100,
        avgLatencyMs: 10000,
        totalInputTokens: 10_000_000,
        totalOutputTokens: 10_000_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(lowErrorStats);
      expect(result.breakdown.errorRate).toBeGreaterThan(85);
    });

    it('verifies tokens per task weight (15%)', () => {
      const efficientTokenStats = {
        totalSessions: 1000,
        successCount: 500,
        errorCount: 50,
        totalCost: 100,
        avgLatencyMs: 10000,
        totalInputTokens: 500_000, // 500 input tokens/task
        totalOutputTokens: 500_000, // 500 output tokens/task
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(efficientTokenStats);
      expect(result.breakdown.tokensPerTask).toBeGreaterThan(85);
    });
  });

  describe('Edge cases', () => {
    it('handles zero sessions', () => {
      const stats = {
        totalSessions: 0,
        successCount: 0,
        errorCount: 0,
        totalCost: 0,
        avgLatencyMs: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.score).toBe(0);
      expect(result.breakdown.tasksPerDollar).toBe(0);
      expect(result.breakdown.latency).toBe(0);
      expect(result.breakdown.successRate).toBe(0);
      expect(result.breakdown.errorRate).toBe(0);
      expect(result.breakdown.tokensPerTask).toBe(0);
    });

    it('handles all errors', () => {
      const stats = {
        totalSessions: 100,
        successCount: 0,
        errorCount: 100,
        totalCost: 10,
        avgLatencyMs: 5000,
        totalInputTokens: 1_000_000,
        totalOutputTokens: 1_000_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.breakdown.successRate).toBe(0);
      expect(result.breakdown.errorRate).toBe(0); // 100% error = worst score
    });

    it('handles zero cost (free sessions)', () => {
      const stats = {
        totalSessions: 1000,
        successCount: 1000,
        errorCount: 0,
        totalCost: 0, // Free or mock sessions
        avgLatencyMs: 5000,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.score).toBeGreaterThan(50); // Should be positive
      expect(result.breakdown.tasksPerDollar).toBeGreaterThan(90); // Excellent efficiency
    });

    it('uses model-specific latency benchmark (Opus)', () => {
      const stats = {
        totalSessions: 100,
        successCount: 100,
        errorCount: 0,
        totalCost: 10,
        avgLatencyMs: 15000, // At Opus benchmark
        totalInputTokens: 1_000_000,
        totalOutputTokens: 1_000_000,
        model: 'claude-opus-4-6',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.breakdown.latency).toBeGreaterThan(40); // At benchmark = mid-range score
    });

    it('uses model-specific latency benchmark (Haiku)', () => {
      const stats = {
        totalSessions: 100,
        successCount: 100,
        errorCount: 0,
        totalCost: 1,
        avgLatencyMs: 3000, // At Haiku benchmark
        totalInputTokens: 500_000,
        totalOutputTokens: 500_000,
        model: 'claude-haiku-4-5',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.breakdown.latency).toBeGreaterThan(40);
    });

    it('uses default benchmark for unknown model', () => {
      const stats = {
        totalSessions: 100,
        successCount: 100,
        errorCount: 0,
        totalCost: 10,
        avgLatencyMs: 10000, // At default benchmark
        totalInputTokens: 1_000_000,
        totalOutputTokens: 1_000_000,
        model: 'unknown-model',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result.breakdown.latency).toBeGreaterThan(40);
    });
  });

  describe('Breakdown structure', () => {
    it('returns all breakdown components', () => {
      const stats = {
        totalSessions: 100,
        successCount: 80,
        errorCount: 10,
        totalCost: 5,
        avgLatencyMs: 5000,
        totalInputTokens: 1_000_000,
        totalOutputTokens: 1_000_000,
        model: 'claude-sonnet-4-5',
      };
      const result = calculateEfficiencyScore(stats);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('breakdown');
      expect(result.breakdown).toHaveProperty('tasksPerDollar');
      expect(result.breakdown).toHaveProperty('latency');
      expect(result.breakdown).toHaveProperty('successRate');
      expect(result.breakdown).toHaveProperty('errorRate');
      expect(result.breakdown).toHaveProperty('tokensPerTask');
    });

    it('ensures all breakdown scores are 0-100', () => {
      const stats = {
        totalSessions: 500,
        successCount: 300,
        errorCount: 100,
        totalCost: 50,
        avgLatencyMs: 12000,
        totalInputTokens: 5_000_000,
        totalOutputTokens: 5_000_000,
        model: 'claude-opus-4-6',
      };
      const result = calculateEfficiencyScore(stats);
      Object.values(result.breakdown).forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
  });
});
