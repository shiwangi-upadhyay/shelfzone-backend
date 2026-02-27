/**
 * Indian Tax Calculation Engine — FY 2025-26
 * Supports New Tax Regime (default) with PF, ESI, Professional Tax
 */

export interface SlabEntry {
  slab: string;
  rate: number;
  tax: number;
}

export interface TaxBreakdown {
  annualGross: number;
  standardDeduction: number;
  taxableIncome: number;
  slabBreakdown: SlabEntry[];
  grossTax: number;
  rebate: number;
  cessRate: number;
  cess: number;
  totalTax: number;
}

interface Slab {
  min: number;
  max: number;
  rate: number;
  label: string;
}

const NEW_REGIME_SLABS: Slab[] = [
  { min: 0, max: 300000, rate: 0, label: '0 - 3,00,000' },
  { min: 300000, max: 700000, rate: 0.05, label: '3,00,001 - 7,00,000' },
  { min: 700000, max: 1000000, rate: 0.10, label: '7,00,001 - 10,00,000' },
  { min: 1000000, max: 1200000, rate: 0.15, label: '10,00,001 - 12,00,000' },
  { min: 1200000, max: 1500000, rate: 0.20, label: '12,00,001 - 15,00,000' },
  { min: 1500000, max: Infinity, rate: 0.30, label: 'Above 15,00,000' },
];

const STANDARD_DEDUCTION = 75000;
const REBATE_THRESHOLD = 700000;
const CESS_RATE = 0.04;
const PF_BASIC_CAP = 15000;
const ESI_GROSS_THRESHOLD = 21000;

function computeSlabTax(taxableIncome: number, slabs: Slab[]): { breakdown: SlabEntry[]; grossTax: number } {
  const breakdown: SlabEntry[] = [];
  let grossTax = 0;

  for (const slab of slabs) {
    if (taxableIncome <= slab.min) {
      breakdown.push({ slab: slab.label, rate: slab.rate, tax: 0 });
      continue;
    }
    const taxable = Math.min(taxableIncome, slab.max) - slab.min;
    const tax = Math.round(taxable * slab.rate * 100) / 100;
    grossTax += tax;
    breakdown.push({ slab: slab.label, rate: slab.rate, tax });
  }

  return { breakdown, grossTax: Math.round(grossTax * 100) / 100 };
}

export function calculateAnnualTax(annualGross: number, regime: 'NEW' | 'OLD' = 'NEW'): TaxBreakdown {
  const standardDeduction = STANDARD_DEDUCTION;
  const taxableIncome = Math.max(0, annualGross - standardDeduction);

  // Only NEW regime implemented for now
  const slabs = regime === 'NEW' ? NEW_REGIME_SLABS : NEW_REGIME_SLABS;

  const { breakdown, grossTax } = computeSlabTax(taxableIncome, slabs);

  // Rebate u/s 87A: if taxable income ≤ 7,00,000, tax = 0
  const rebate = taxableIncome <= REBATE_THRESHOLD ? grossTax : 0;
  const taxAfterRebate = grossTax - rebate;

  const cess = Math.round(taxAfterRebate * CESS_RATE * 100) / 100;
  const totalTax = Math.round((taxAfterRebate + cess) * 100) / 100;

  return {
    annualGross,
    standardDeduction,
    taxableIncome,
    slabBreakdown: breakdown,
    grossTax,
    rebate,
    cessRate: CESS_RATE,
    cess,
    totalTax,
  };
}

export function calculateMonthlyTDS(annualGross: number, monthsRemaining: number, taxPaidSoFar: number): number {
  if (monthsRemaining <= 0) return 0;
  const { totalTax } = calculateAnnualTax(annualGross);
  const remaining = Math.max(0, totalTax - taxPaidSoFar);
  return Math.round((remaining / monthsRemaining) * 100) / 100;
}

export function calculatePF(basicMonthly: number): { employee: number; employer: number } {
  const cappedBasic = Math.min(basicMonthly, PF_BASIC_CAP);
  const employee = Math.round(cappedBasic * 0.12 * 100) / 100;
  const employer = Math.round(cappedBasic * 0.12 * 100) / 100;
  // Employer split: 8.33% EPS + 3.67% EPF = 12%
  return { employee, employer };
}

export function calculateESI(grossMonthly: number): { employee: number; employer: number } | null {
  if (grossMonthly > ESI_GROSS_THRESHOLD) return null;
  return {
    employee: Math.round(grossMonthly * 0.0075 * 100) / 100,
    employer: Math.round(grossMonthly * 0.0325 * 100) / 100,
  };
}

export function calculateProfessionalTax(grossMonthly: number, state: string = 'KARNATAKA'): number {
  const s = state.toUpperCase();
  switch (s) {
    case 'KARNATAKA':
      return grossMonthly > 15000 ? 200 : 0;
    case 'MAHARASHTRA':
      return grossMonthly > 10000 ? 200 : 0;
    default:
      return grossMonthly > 15000 ? 200 : 0;
  }
}
