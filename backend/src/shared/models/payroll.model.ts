import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'payroll';
const COLLECTION_NAME = 'payrolls';

export const PAYROLL_STATUS = ['draft', 'approved', 'paid'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUS)[number];

type Dec = mongoose.Types.Decimal128;

export interface IPayroll {
  payrollPeriodId: Types.ObjectId;
  employeeId: Types.ObjectId;
  policyConfigId?: Types.ObjectId | null;
  monthlyEvaluationId?: Types.ObjectId | null;

  // Work days
  standardWorkDays: number;
  actualWorkDays: number;
  unpaidLeaveDays: number;
  workDays: number;

  // 20/60/20 effective base salary breakdown
  /** actualWorkDays / standardWorkDays, 0–1. */
  attendanceRatio: number;
  /** snapshot from MonthlyEvaluation, 0–100. */
  performanceRatio: number;
  /** snapshot from MonthlyEvaluation, 0–100. */
  goalRatio: number;
  attendanceComponent: Dec;
  performanceComponent: Dec;
  goalComponent: Dec;

  // Base
  baseSalary: Dec;
  /** = attendanceComponent + performanceComponent + goalComponent. */
  proRatedBaseSalary: Dec;

  // Allowances / overtime / bonuses
  totalTaxableAllowances: Dec;
  totalNonTaxableAllowances: Dec;
  totalAllowances: Dec;
  overtimePay: Dec;
  totalBonuses: Dec;
  grossSalary: Dec;

  // Insurance (employee)
  insuranceBase: Dec;
  unemploymentInsuranceBase: Dec;
  socialInsurance: Dec;
  healthInsurance: Dec;
  unemploymentInsurance: Dec;
  insurance: Dec;

  // Insurance (employer)
  employerSocialInsurance: Dec;
  employerHealthInsurance: Dec;
  employerUnemploymentInsurance: Dec;
  employerOccupationalInsurance: Dec;

  // Tax
  taxableIncome: Dec;
  personalDeduction: Dec;
  dependentDeduction: Dec;
  dependentsCount: number;
  taxableIncomeAfterDeduction: Dec;
  tax: Dec;

  // Net
  totalDeductions: Dec;
  netSalary: Dec;

  leaveDays: number;
  status: PayrollStatus;
  approvedBy?: Types.ObjectId | null;
  paidAt?: Date | null;
  computedAt?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export type PayrollDoc = HydratedDocument<IPayroll>;

const dec = { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString('0') };

const payrollSchema = new Schema<IPayroll>(
  {
    payrollPeriodId: {
      type: Schema.Types.ObjectId,
      ref: 'payrollPeriods',
      required: true,
      index: true,
    },
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    policyConfigId: { type: Schema.Types.ObjectId, ref: 'salaryPolicyConfigs', default: null },
    monthlyEvaluationId: {
      type: Schema.Types.ObjectId,
      ref: 'monthlyEvaluations',
      default: null,
    },

    standardWorkDays: { type: Number, default: 0 },
    actualWorkDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    workDays: { type: Number, default: 0 },

    attendanceRatio: { type: Number, default: 0 },
    performanceRatio: { type: Number, default: 0 },
    goalRatio: { type: Number, default: 0 },
    attendanceComponent: dec,
    performanceComponent: dec,
    goalComponent: dec,

    baseSalary: dec,
    proRatedBaseSalary: dec,

    totalTaxableAllowances: dec,
    totalNonTaxableAllowances: dec,
    totalAllowances: dec,
    overtimePay: dec,
    totalBonuses: dec,
    grossSalary: dec,

    insuranceBase: dec,
    unemploymentInsuranceBase: dec,
    socialInsurance: dec,
    healthInsurance: dec,
    unemploymentInsurance: dec,
    insurance: dec,

    employerSocialInsurance: dec,
    employerHealthInsurance: dec,
    employerUnemploymentInsurance: dec,
    employerOccupationalInsurance: dec,

    taxableIncome: dec,
    personalDeduction: dec,
    dependentDeduction: dec,
    dependentsCount: { type: Number, default: 0 },
    taxableIncomeAfterDeduction: dec,
    tax: dec,

    totalDeductions: dec,
    netSalary: dec,

    leaveDays: { type: Number, default: 0 },
    status: { type: String, enum: PAYROLL_STATUS, default: 'draft', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    paidAt: { type: Date, default: null },
    computedAt: { type: Date, default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

payrollSchema.index({ payrollPeriodId: 1, employeeId: 1 }, { unique: true });

export const Payroll = mongoose.model<IPayroll>(DB_NAME, payrollSchema);
