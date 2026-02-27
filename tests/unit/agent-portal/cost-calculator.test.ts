import { calculateSessionCost, getModelRates } from '../../../src/lib/cost-calculator.js';

describe('calculateSessionCost()', () => {
  describe('Claude Opus', () => {
    it('calculates cost correctly for Claude Opus', () => {
      const result = calculateSessionCost('claude-opus-4-6', 1_000_000, 1_000_000);
      expect(result.inputCost).toBe(15);
      expect(result.outputCost).toBe(75);
      expect(result.totalCost).toBe(90);
    });

    it('splits input vs output cost correctly', () => {
      const result = calculateSessionCost('claude-opus-4-6', 500_000, 200_000);
      expect(result.inputCost).toBe(7.5); // 500k / 1M * $15
      expect(result.outputCost).toBe(15); // 200k / 1M * $75
      expect(result.totalCost).toBe(22.5);
    });
  });

  describe('Claude Sonnet', () => {
    it('calculates cost correctly for Claude Sonnet', () => {
      const result = calculateSessionCost('claude-sonnet-4-5', 1_000_000, 1_000_000);
      expect(result.inputCost).toBe(3);
      expect(result.outputCost).toBe(15);
      expect(result.totalCost).toBe(18);
    });
  });

  describe('Claude Haiku', () => {
    it('calculates cost correctly for Claude Haiku', () => {
      const result = calculateSessionCost('claude-haiku-4-5', 1_000_000, 1_000_000);
      expect(result.inputCost).toBe(0.25);
      expect(result.outputCost).toBe(1.25);
      expect(result.totalCost).toBe(1.5);
    });
  });

  describe('Unknown model fallback', () => {
    it('falls back to default rate for unknown model', () => {
      const result = calculateSessionCost('claude-unknown-model', 1_000_000, 1_000_000);
      expect(result.inputCost).toBe(3); // Default rate
      expect(result.outputCost).toBe(15); // Default rate
      expect(result.totalCost).toBe(18);
    });
  });

  describe('Edge cases', () => {
    it('handles zero tokens', () => {
      const result = calculateSessionCost('claude-opus-4-6', 0, 0);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('handles zero input tokens', () => {
      const result = calculateSessionCost('claude-opus-4-6', 0, 1_000_000);
      expect(result.inputCost).toBe(0);
      expect(result.outputCost).toBe(75);
      expect(result.totalCost).toBe(75);
    });

    it('handles zero output tokens', () => {
      const result = calculateSessionCost('claude-opus-4-6', 1_000_000, 0);
      expect(result.inputCost).toBe(15);
      expect(result.outputCost).toBe(0);
      expect(result.totalCost).toBe(15);
    });

    it('handles large token counts', () => {
      const result = calculateSessionCost('claude-opus-4-6', 100_000_000, 50_000_000);
      expect(result.inputCost).toBe(1500); // 100M / 1M * $15
      expect(result.outputCost).toBe(3750); // 50M / 1M * $75
      expect(result.totalCost).toBe(5250);
    });

    it('handles small token counts with fractional costs', () => {
      const result = calculateSessionCost('claude-haiku-4-5', 1000, 500);
      expect(result.inputCost).toBeCloseTo(0.00025, 6); // 1000 / 1M * $0.25
      expect(result.outputCost).toBeCloseTo(0.000625, 6); // 500 / 1M * $1.25
      expect(result.totalCost).toBeCloseTo(0.000875, 6);
    });
  });
});

describe('getModelRates()', () => {
  it('returns all model rates', () => {
    const rates = getModelRates();
    expect(rates).toHaveProperty('claude-opus-4-6');
    expect(rates).toHaveProperty('claude-sonnet-4-5');
    expect(rates).toHaveProperty('claude-haiku-4-5');
    expect(rates['claude-opus-4-6']).toEqual({ input: 15, output: 75 });
    expect(rates['claude-sonnet-4-5']).toEqual({ input: 3, output: 15 });
    expect(rates['claude-haiku-4-5']).toEqual({ input: 0.25, output: 1.25 });
  });
});
