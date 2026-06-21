/// <reference types="jest" />
import mongoose from 'mongoose';

import { buildPayrollDoc, type PayrollRunContext } from '@features/payroll/services/payroll-run.service';

const oid = () => new mongoose.Types.ObjectId();
const num = (d: mongoose.Types.Decimal128) => Number(d.toString());

const baseCtx = (over: Partial<PayrollRunContext> = {}): PayrollRunContext => ({
  payrollPeriodId: oid(),
  employeeId: oid(),
  policyConfigId: oid(),
  monthlyEvaluationId: oid(),
  standardWorkDays: 22,
  actualWorkDays: 22,
  unpaidLeaveDays: 0,
  workDays: 22,
  leaveDays: 0,
  performanceRatio: 100,
  goalRatio: 100,
  baseSalary: 30_000_000,
  totalTaxableAllowances: 2_000_000,
  totalNonTaxableAllowances: 730_000,
  insuranceBaseSalary: 30_000_000,
  insuranceBaseAllowances: 0,
  unionFee: 0,
  deductions: [],
  overtimePay: 0,
  totalBonuses: 0,
  socialHealthCeiling: 46_800_000,
  unemploymentCeiling: 99_200_000,
  personalDeduction: 11_000_000,
  dependentDeduction: 4_400_000,
  dependentsCount: 1,
  isResident: true,
  ...over,
});

describe('buildPayrollDoc', () => {
  it('mirrors the E1 parallel-run case onto a Payroll doc (Decimal128)', () => {
    const doc = buildPayrollDoc(baseCtx());
    expect(doc.attendanceRatio).toBe(1);
    expect(num(doc.grossSalary)).toBe(32_730_000);
    // insurance base = pro-rated salary only (allowances not flagged) → 30m × 10.5%
    expect(num(doc.insurance)).toBe(3_150_000);
    expect(num(doc.tax)).toBe(1_267_500);
    expect(num(doc.netSalary)).toBe(28_312_500);
    expect(doc.status).toBe('draft');
    expect(doc.dependentsCount).toBe(1);
  });

  it('caps attendanceRatio at 1 when worked days exceed the standard', () => {
    const doc = buildPayrollDoc(baseCtx({ actualWorkDays: 25, workDays: 25 }));
    expect(doc.attendanceRatio).toBe(1);
    // attendance component stays at the full 20% (0.2 × 30m), not inflated
    expect(num(doc.attendanceComponent)).toBe(6_000_000);
  });

  it('adds isInsuranceBase allowances to the insurance base', () => {
    const doc = buildPayrollDoc(baseCtx({ insuranceBaseAllowances: 2_000_000 }));
    // base = 30m + 2m = 32m × 10.5% = 3,360,000
    expect(num(doc.insurance)).toBe(3_360_000);
  });

  it('computes insurance on the FIXED contract base, not the prorated pay', () => {
    // Half attendance + lower perf/goal → proRated drops, but the insurance base
    // stays the fixed contract salary (30m) → insurance unchanged.
    const doc = buildPayrollDoc(
      baseCtx({ actualWorkDays: 11, workDays: 11, unpaidLeaveDays: 11, performanceRatio: 80, goalRatio: 90 }),
    );
    expect(num(doc.proRatedBaseSalary)).toBeLessThan(30_000_000);
    expect(num(doc.insurance)).toBe(3_150_000); // 30m × 10.5%
  });

  it('charges no insurance when insuranceBaseSalary = 0 (e.g. probation)', () => {
    const doc = buildPayrollDoc(baseCtx({ insuranceBaseSalary: 0 }));
    expect(num(doc.insurance)).toBe(0);
    expect(num(doc.employerSocialInsurance)).toBe(0);
  });

  it('applies post-tax deductions (fixed + percentage) to net', () => {
    const doc = buildPayrollDoc(baseCtx({ deductions: [{ type: "fixed", amount: 500_000 }, { type: "percentage", amount: 10 }] }));
    // gross 32,730,000 → 10% = 3,273,000 + 500,000 fixed = 3,773,000
    expect(num(doc.otherDeductions)).toBe(3_773_000);
    const baseline = buildPayrollDoc(baseCtx());
    expect(num(baseline.netSalary) - num(doc.netSalary)).toBe(3_773_000);
  });

  it('subtracts the union fee from net and adds it to total deductions', () => {
    const withFee = buildPayrollDoc(baseCtx({ unionFee: 55_000 }));
    const without = buildPayrollDoc(baseCtx({ unionFee: 0 }));
    expect(num(withFee.unionFee)).toBe(55_000);
    expect(num(without.netSalary) - num(withFee.netSalary)).toBe(55_000);
    expect(num(withFee.totalDeductions) - num(without.totalDeductions)).toBe(55_000);
  });

  it('derives attendanceRatio from work days and prorates gross', () => {
    const doc = buildPayrollDoc(
      baseCtx({
        actualWorkDays: 11,
        workDays: 11,
        unpaidLeaveDays: 11,
        totalTaxableAllowances: 0,
        totalNonTaxableAllowances: 0,
        dependentsCount: 0,
      }),
    );
    expect(doc.attendanceRatio).toBe(0.5);
    // attendance component halved: 0.2*30m*0.5 = 3m ; perf 6m ; goal... wait full perf/goal
    // proRated = 3m + 6m(0.6*30m*1) ... actually performanceRatio 100 → 18m, goal 6m
    // 0.2*30m*0.5=3m + 0.6*30m=18m + 0.2*30m=6m = 27m
    expect(num(doc.proRatedBaseSalary)).toBe(27_000_000);
    expect(num(doc.grossSalary)).toBe(27_000_000);
  });

  it('keeps the net invariant: net = gross - insurance - tax', () => {
    const doc = buildPayrollDoc(baseCtx());
    expect(num(doc.netSalary)).toBe(num(doc.grossSalary) - num(doc.insurance) - num(doc.tax));
  });

  it('carries the policy reference and computed work-day fields', () => {
    const ctx = baseCtx();
    const doc = buildPayrollDoc(ctx);
    expect(doc.policyConfigId).toBe(ctx.policyConfigId);
    expect(doc.standardWorkDays).toBe(22);
    expect(doc.computedAt).toBeInstanceOf(Date);
  });
});
