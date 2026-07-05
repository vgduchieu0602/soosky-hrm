/**
 * Persistence mapper for the payroll run engine: turns fully-resolved numeric
 * inputs into a Mongoose-shaped Payroll document (money as Decimal128). Kept in
 * infrastructure because it constructs Decimal128/ObjectId persistence values;
 * the pure numeric engine it delegates to lives in `@shared/utils/salary.util`.
 */
import mongoose from 'mongoose';

import { type IPayroll } from '@shared/models/payroll.model';
import {
  computeAttendanceRatio,
  computePayroll,
  type SalaryComponentWeights,
  type TaxBracket,
  type InsuranceRates,
} from '@shared/utils/salary.util';

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(Math.round(n)));

export interface PayrollRunContext {
  payrollPeriodId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  policyConfigId?: mongoose.Types.ObjectId | null;
  monthlyEvaluationId?: mongoose.Types.ObjectId | null;

  standardWorkDays: number;
  actualWorkDays: number;
  unpaidLeaveDays: number;
  workDays: number;
  leaveDays: number;

  performanceRatio: number;
  goalRatio: number;
  weights?: SalaryComponentWeights;

  baseSalary: number;
  totalTaxableAllowances: number;
  totalNonTaxableAllowances: number;
  /** Fixed company salary the insurance is contributed on (0 = no insurance, e.g. probation). */
  insuranceBaseSalary: number;
  insuranceBaseAllowances: number;
  /** Fixed BHXH amount entered by HR (overrides %-based insurance). */
  fixedInsuranceAmount?: number;
  /** Enable PIT (default off — simplified payroll). */
  taxEnabled?: boolean;
  /** Union fee (đoàn phí) — fixed post-tax deduction. */
  unionFee: number;
  /** Other post-tax deductions (recurring + one-off for the period). */
  deductions: { type: 'fixed' | 'percentage'; amount: number }[];
  overtimePay: number;
  /** PIT-exempt portion of overtimePay (the premium above the normal wage). */
  overtimeNonTaxablePay: number;
  totalBonuses: number;
  totalNonTaxableBonuses: number;

  socialHealthCeiling: number;
  unemploymentCeiling: number;
  personalDeduction: number;
  dependentDeduction: number;
  dependentsCount: number;
  taxBrackets?: TaxBracket[];
  isResident: boolean;
  nonResidentTaxRate?: number;
  insuranceRates?: InsuranceRates;
}

/** Map resolved inputs onto a Payroll document (money as Decimal128). Pure. */
export function buildPayrollDoc(ctx: PayrollRunContext): IPayroll {
  // Cap at 1: working more days than the period standard must not inflate the
  // 20% attendance component beyond full.
  const attendanceRatio = Math.min(1, computeAttendanceRatio(ctx.actualWorkDays, ctx.standardWorkDays));

  const r = computePayroll({
    baseSalary: ctx.baseSalary,
    attendanceRatio,
    performanceRatio: ctx.performanceRatio,
    goalRatio: ctx.goalRatio,
    weights: ctx.weights,
    totalTaxableAllowances: ctx.totalTaxableAllowances,
    totalNonTaxableAllowances: ctx.totalNonTaxableAllowances,
    insuranceBaseSalary: ctx.insuranceBaseSalary,
    insuranceBaseAllowances: ctx.insuranceBaseAllowances,
    fixedInsuranceAmount: ctx.fixedInsuranceAmount,
    taxEnabled: ctx.taxEnabled,
    unionFee: ctx.unionFee,
    deductions: ctx.deductions,
    overtimePay: ctx.overtimePay,
    overtimeNonTaxablePay: ctx.overtimeNonTaxablePay,
    totalBonuses: ctx.totalBonuses,
    totalNonTaxableBonuses: ctx.totalNonTaxableBonuses,
    socialHealthCeiling: ctx.socialHealthCeiling,
    unemploymentCeiling: ctx.unemploymentCeiling,
    personalDeduction: ctx.personalDeduction,
    dependentDeduction: ctx.dependentDeduction,
    dependentsCount: ctx.dependentsCount,
    taxBrackets: ctx.taxBrackets,
    isResident: ctx.isResident,
    nonResidentTaxRate: ctx.nonResidentTaxRate,
    insuranceRates: ctx.insuranceRates,
  });

  return {
    payrollPeriodId: ctx.payrollPeriodId,
    employeeId: ctx.employeeId,
    policyConfigId: ctx.policyConfigId ?? null,
    monthlyEvaluationId: ctx.monthlyEvaluationId ?? null,

    standardWorkDays: ctx.standardWorkDays,
    actualWorkDays: ctx.actualWorkDays,
    unpaidLeaveDays: ctx.unpaidLeaveDays,
    workDays: ctx.workDays,

    attendanceRatio,
    performanceRatio: ctx.performanceRatio,
    goalRatio: ctx.goalRatio,
    attendanceComponent: dec(r.attendanceComponent),
    performanceComponent: dec(r.performanceComponent),
    goalComponent: dec(r.goalComponent),

    baseSalary: dec(r.baseSalary),
    proRatedBaseSalary: dec(r.proRatedBaseSalary),

    totalTaxableAllowances: dec(r.totalTaxableAllowances),
    totalNonTaxableAllowances: dec(r.totalNonTaxableAllowances),
    totalAllowances: dec(r.totalAllowances),
    overtimePay: dec(r.overtimePay),
    totalBonuses: dec(r.totalBonuses),
    grossSalary: dec(r.grossSalary),

    insuranceBase: dec(r.insuranceBase),
    unemploymentInsuranceBase: dec(r.unemploymentInsuranceBase),
    socialInsurance: dec(r.socialInsurance),
    healthInsurance: dec(r.healthInsurance),
    unemploymentInsurance: dec(r.unemploymentInsurance),
    insurance: dec(r.insurance),

    employerSocialInsurance: dec(r.employerSocialInsurance),
    employerHealthInsurance: dec(r.employerHealthInsurance),
    employerUnemploymentInsurance: dec(r.employerUnemploymentInsurance),
    employerOccupationalInsurance: dec(r.employerOccupationalInsurance),

    taxableIncome: dec(r.taxableIncome),
    personalDeduction: dec(r.personalDeduction),
    dependentDeduction: dec(r.dependentDeduction),
    dependentsCount: r.dependentsCount,
    taxableIncomeAfterDeduction: dec(r.taxableIncomeAfterDeduction),
    tax: dec(r.tax),
    unionFee: dec(r.unionFee),
    otherDeductions: dec(r.otherDeductions),

    totalDeductions: dec(r.totalDeductions),
    netSalary: dec(r.netSalary),

    leaveDays: ctx.leaveDays,
    status: 'draft',
    computedAt: new Date(),
  };
}
