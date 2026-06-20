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
    expect(num(doc.insurance)).toBe(3_436_650);
    expect(num(doc.tax)).toBe(1_224_503);
    expect(num(doc.netSalary)).toBe(28_068_847);
    expect(doc.status).toBe('draft');
    expect(doc.dependentsCount).toBe(1);
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
