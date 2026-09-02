import mongoose from 'mongoose';

import { buildPayrollDoc, type PayrollRunContext } from '@modules/hrm/core/payroll/app/payroll-run.usecases';

const oid = () => new mongoose.Types.ObjectId();
const num = (d: mongoose.Types.Decimal128) => Number(d.toString());

const baseCtx = (over: Partial<PayrollRunContext> = {}): PayrollRunContext => {
  const merged = {
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
    snapshot: {
      period: {
        name: '2026-08',
        startDate: new Date('2026-08-01T00:00:00.000Z'),
        endDate: new Date('2026-08-31T00:00:00.000Z'),
        payDate: new Date('2026-09-05T00:00:00.000Z'),
      },
      employment: {
        hireDate: new Date('2020-01-01T00:00:00.000Z'),
        terminationDate: null,
        effectiveStart: new Date('2026-08-01T00:00:00.000Z'),
        effectiveEnd: new Date('2026-08-31T00:00:00.000Z'),
      },
      evaluation: {
        status: 'approved',
        criteria: [{ criterionId: oid(), name: 'Quality', group: 'performance', weight: 30, score: 92 }],
      },
      policy: {
        effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
        internPayAmount: 1_500_000,
        probationPayRate: 85,
        socialInsuranceSalary: 30_000_000,
        unionFeeRate: 0,
        unionFeeEnabled: false,
      },
      insuranceExempt: false,
    },
    baseSalary: 30_000_000,
    totalTaxableAllowances: 2_000_000,
    totalNonTaxableAllowances: 730_000,
    insuranceBaseSalary: 30_000_000,
    insuranceBaseAllowances: 0,
    unionFee: 0,
    deductions: [],
    overtimePay: 0,
    overtimeNonTaxablePay: 0,
    totalBonuses: 0,
    totalNonTaxableBonuses: 0,
    socialHealthCeiling: 46_800_000,
    unemploymentCeiling: 99_200_000,
    personalDeduction: 11_000_000,
    dependentDeduction: 4_400_000,
    dependentsCount: 1,
    isResident: true,
    taxEnabled: true, // these specs verify the tax engine; production defaults to off
    ...over,
  } as PayrollRunContext;

  // Mặc định: MỘT đoạn hợp đồng phủ cả kỳ, phản chiếu đúng các giá trị cấp kỳ —
  // đây là đường đi cũ (một hợp đồng duy nhất) và phải cho kết quả y hệt.
  merged.segments = over.segments ?? [
    {
      contractId: oid(),
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-08-31T00:00:00.000Z'),
      employmentStatus: 'official',
      baseSalary: merged.baseSalary,
      payRate: 1,
      standardWorkDays: merged.standardWorkDays,
      actualWorkDays: merged.actualWorkDays,
      performanceRatio: merged.performanceRatio,
      goalRatio: merged.goalRatio,
      weights: merged.weights ?? { attendance: 20, performance: 60, goal: 20 },
    },
  ];

  return merged;
};

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

  it('excludes non-taxable bonuses from taxable income (so they are not taxed)', () => {
    const taxed = buildPayrollDoc(baseCtx({ totalBonuses: 5_000_000, totalNonTaxableBonuses: 0 }));
    const exempt = buildPayrollDoc(baseCtx({ totalBonuses: 5_000_000, totalNonTaxableBonuses: 5_000_000 }));
    // Same gross, but the exempt bonus lowers taxable income → lower tax → higher net.
    expect(num(exempt.grossSalary)).toBe(num(taxed.grossSalary));
    expect(num(exempt.tax)).toBeLessThan(num(taxed.tax));
    expect(num(exempt.netSalary)).toBeGreaterThan(num(taxed.netSalary));
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
    // Only the 20% attendance component is prorated by days worked; perf & goal
    // are paid in full per their ratios:
    //   attendance 0.2*30m*0.5 = 3m ; perf 0.6*30m*1 = 18m ; goal 0.2*30m*1 = 6m
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

  it('records a self-explanatory immutable calculation snapshot', () => {
    const ctx = baseCtx({
      fixedInsuranceAmount: 570_000,
      weights: { attendance: 20, performance: 60, goal: 20 },
    });
    const doc = buildPayrollDoc(ctx);
    const snapshot = doc.calculationSnapshot!;

    expect(snapshot.version).toBe(2);
    expect(snapshot.period).toEqual(ctx.snapshot.period);
    expect(snapshot.employment).toEqual(ctx.snapshot.employment);
    expect(snapshot.policy).toMatchObject({
      policyId: ctx.policyConfigId,
      weights: { attendance: 20, performance: 60, goal: 20 },
      internPayAmount: expect.objectContaining({ toString: expect.any(Function) }),
      socialInsuranceSalary: expect.objectContaining({ toString: expect.any(Function) }),
    });
    expect(num(snapshot.policy.internPayAmount)).toBe(1_500_000);
    expect(num(snapshot.policy.socialInsuranceSalary)).toBe(30_000_000);
    expect(snapshot.evaluation).toMatchObject({
      evaluationId: ctx.monthlyEvaluationId,
      performanceRatio: 100,
      goalRatio: 100,
      criteria: ctx.snapshot.evaluation.criteria,
    });
    expect(snapshot.insurance).toMatchObject({ employeeDeduction: expect.anything() });
    expect(num(snapshot.insurance.fixedAmount)).toBe(570_000);
    expect(num(snapshot.insurance.employeeDeduction)).toBe(num(doc.insurance));
    expect(num(snapshot.totals.netSalary)).toBe(num(doc.netSalary));
  });

  it('keeps source values captured at calculation even when the input objects are later changed', () => {
    const rates = {
      employee: { social: 8, health: 1.5, unemployment: 1 },
      employer: { social: 17, health: 3, unemployment: 1, occupational: 0.5 },
    };
    const ctx = baseCtx({
      weights: { attendance: 20, performance: 60, goal: 20 },
      insuranceRates: rates as never,
    });
    const doc = buildPayrollDoc(ctx);

    ctx.segments[0]!.baseSalary = 20_000_000;
    ctx.segments[0]!.weights.attendance = 30;
    ctx.segments[0]!.from.setUTCDate(2);
    ctx.weights!.attendance = 30;
    ctx.snapshot.period.startDate.setUTCDate(2);
    ctx.snapshot.employment.effectiveStart.setUTCDate(2);
    ctx.snapshot.policy.socialInsuranceSalary = 20_000_000;
    ctx.snapshot.policy.internPayAmount = 1_800_000;
    ctx.snapshot.evaluation.criteria[0]!.score = 10;
    rates.employee.social = 9;

    const snapshot = doc.calculationSnapshot!;
    expect(num(snapshot.contracts[0]!.baseSalary)).toBe(30_000_000);
    expect(snapshot.contracts[0]!.weights.attendance).toBe(20);
    expect(snapshot.contracts[0]!.from.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(snapshot.period.startDate.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(snapshot.employment.effectiveStart.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(snapshot.policy.weights.attendance).toBe(20);
    expect(num(snapshot.policy.socialInsuranceSalary)).toBe(30_000_000);
    expect(num(snapshot.policy.internPayAmount)).toBe(1_500_000);
    expect(snapshot.evaluation.criteria[0]!.score).toBe(92);
    expect(snapshot.evaluation.criteria[0]).toMatchObject({
      name: 'Quality',
      group: 'performance',
      weight: 30,
    });
    expect(snapshot.insurance.rates).toMatchObject({ employee: { social: 8, health: 1.5 } });
  });
});
