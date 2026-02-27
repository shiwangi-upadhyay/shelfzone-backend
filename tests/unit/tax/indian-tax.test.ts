import {
  calculateAnnualTax,
  calculateMonthlyTDS,
  calculatePF,
  calculateESI,
  calculateProfessionalTax,
} from '../../../src/lib/tax/indian-tax.js';

describe('Indian Tax Calculation Engine', () => {
  describe('calculateAnnualTax — New Regime FY 2025-26', () => {
    it('should return zero tax for 5L (rebate applies)', () => {
      const result = calculateAnnualTax(500000);
      // Taxable = 500000 - 75000 = 425000 → ≤ 7L → rebate
      expect(result.taxableIncome).toBe(425000);
      expect(result.totalTax).toBe(0);
      expect(result.rebate).toBe(result.grossTax);
    });

    it('should return zero tax for 7L gross (rebate applies)', () => {
      const result = calculateAnnualTax(700000);
      // Taxable = 700000 - 75000 = 625000 → ≤ 7L → rebate
      expect(result.taxableIncome).toBe(625000);
      expect(result.totalTax).toBe(0);
    });

    it('should compute correct tax for 8L gross', () => {
      const result = calculateAnnualTax(800000);
      // Taxable = 725000
      // 0-3L: 0, 3-7L: 20000, 7-7.25L: 2500
      expect(result.taxableIncome).toBe(725000);
      expect(result.grossTax).toBe(22500);
      expect(result.rebate).toBe(0);
      expect(result.cess).toBe(900); // 22500 * 0.04
      expect(result.totalTax).toBe(23400);
    });

    it('should compute correct tax for 12L gross', () => {
      const result = calculateAnnualTax(1200000);
      // Taxable = 1125000
      // 0-3L: 0, 3-7L: 20000, 7-10L: 30000, 10-11.25L: 18750
      expect(result.taxableIncome).toBe(1125000);
      expect(result.grossTax).toBe(68750);
      expect(result.rebate).toBe(0);
      const cess = Math.round(68750 * 0.04 * 100) / 100;
      expect(result.cess).toBe(cess);
      expect(result.totalTax).toBe(Math.round((68750 + cess) * 100) / 100);
    });

    it('should compute correct tax for 20L gross', () => {
      const result = calculateAnnualTax(2000000);
      // Taxable = 1925000
      // 0-3L: 0, 3-7L: 20000, 7-10L: 30000, 10-12L: 30000, 12-15L: 60000, 15-19.25L: 127500
      const expectedGross = 0 + 20000 + 30000 + 30000 + 60000 + 127500;
      expect(result.taxableIncome).toBe(1925000);
      expect(result.grossTax).toBe(expectedGross);
      expect(result.rebate).toBe(0);
      const cess = Math.round(expectedGross * 0.04 * 100) / 100;
      expect(result.totalTax).toBe(Math.round((expectedGross + cess) * 100) / 100);
    });
  });

  describe('calculateMonthlyTDS', () => {
    it('should prorate remaining tax over months', () => {
      const annualTax = calculateAnnualTax(2000000).totalTax;
      const tds = calculateMonthlyTDS(2000000, 12, 0);
      expect(tds).toBe(Math.round((annualTax / 12) * 100) / 100);
    });

    it('should subtract tax already paid', () => {
      const annualTax = calculateAnnualTax(2000000).totalTax;
      const paid = 100000;
      const tds = calculateMonthlyTDS(2000000, 6, paid);
      expect(tds).toBe(Math.round(((annualTax - paid) / 6) * 100) / 100);
    });

    it('should return 0 if monthsRemaining is 0', () => {
      expect(calculateMonthlyTDS(2000000, 0, 0)).toBe(0);
    });
  });

  describe('calculatePF', () => {
    it('should calculate PF for basic below cap', () => {
      const result = calculatePF(10000);
      expect(result.employee).toBe(1200);
      expect(result.employer).toBe(1200);
    });

    it('should cap PF at basic of 15000', () => {
      const result = calculatePF(25000);
      expect(result.employee).toBe(1800); // 15000 * 0.12
      expect(result.employer).toBe(1800);
    });

    it('should cap PF at exactly 15000 basic', () => {
      const result = calculatePF(15000);
      expect(result.employee).toBe(1800);
      expect(result.employer).toBe(1800);
    });
  });

  describe('calculateESI', () => {
    it('should calculate ESI for gross ≤ 21000', () => {
      const result = calculateESI(20000);
      expect(result).not.toBeNull();
      expect(result!.employee).toBe(150); // 20000 * 0.0075
      expect(result!.employer).toBe(650); // 20000 * 0.0325
    });

    it('should return null for gross > 21000', () => {
      expect(calculateESI(25000)).toBeNull();
    });

    it('should calculate ESI at threshold', () => {
      const result = calculateESI(21000);
      expect(result).not.toBeNull();
      expect(result!.employee).toBe(157.5);
      expect(result!.employer).toBe(682.5);
    });
  });

  describe('calculateProfessionalTax', () => {
    it('should return 200 for Karnataka when gross > 15000', () => {
      expect(calculateProfessionalTax(20000, 'KARNATAKA')).toBe(200);
    });

    it('should return 0 for Karnataka when gross ≤ 15000', () => {
      expect(calculateProfessionalTax(15000, 'KARNATAKA')).toBe(0);
    });

    it('should return 200 for Maharashtra when gross > 10000', () => {
      expect(calculateProfessionalTax(12000, 'MAHARASHTRA')).toBe(200);
    });

    it('should return 0 for Maharashtra when gross ≤ 10000', () => {
      expect(calculateProfessionalTax(10000, 'MAHARASHTRA')).toBe(0);
    });

    it('should handle case-insensitive state', () => {
      expect(calculateProfessionalTax(20000, 'karnataka')).toBe(200);
    });

    it('should use default for unknown state', () => {
      expect(calculateProfessionalTax(20000, 'DELHI')).toBe(200);
      expect(calculateProfessionalTax(10000, 'DELHI')).toBe(0);
    });
  });
});
