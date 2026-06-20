/**
 * Payroll Run engine — resolves every input for an employee in a period, runs
 * the pure `computePayroll` chain, and upserts a Payroll record.
 *
 *   contract.baseSalary ┐
 *   attendance summary  ├─▶ computePayroll() ─▶ buildPayrollDoc() ─▶ upsert Payroll
 *   monthlyEvaluation   │
 *   salaryPolicyConfig  │
 *   taxProfile          │
 *   allowances/bonuses ─┘
 *
 * Idempotent on the unique { payrollPeriodId, employeeId } index: re-running a
 * period recomputes `draft` rows and refuses to touch `approved`/`paid` ones.
 */
import mongoose from 'mongoose';

import { Allowance } from '@shared/models/allowance.model';
import { Bonus } from '@shared/models/bonus.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeTaxProfile } from '@shared/models/employee-tax-profile.model';
import { Employee } from '@shared/models/employee.model';
import { MonthlyEvaluation } from '@shared/models/monthly-evaluation.model';
import { Payroll, type IPayroll } from '@shared/models/payroll.model';
import { PayrollPeriod, type PayrollPeriodDoc } from '@shared/models/payroll-period.model';
import { SalaryPolicyConfig } from '@shared/models/salary-policy-config.model';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { logger } from '@core/logger/logger';
import {
  computeAttendanceRatio,
  computePayroll,
  type SalaryComponentWeights,
  type TaxBracket,
  type InsuranceRates,
} from '@shared/utils/salary.util';

import { aggregatePeriodAttendance } from './attendance-aggregate.service';

const log = logger.child({ feature: 'payroll', module: 'run' });

/** 409 conflict with a payroll-scoped error code. */
const conflict = (message: string, code = 'PAY_409') => new HttpError(409, message, code);

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(Math.round(n)));
const toNum = (d: mongoose.Types.Decimal128 | number | null | undefined): number =>
  d == null ? 0 : Number(d.toString());

// ---------------------------------------------------------------------------
// Pure core — assemble a Payroll document from fully-resolved numeric inputs.
// ---------------------------------------------------------------------------

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
  overtimePay: number;
  totalBonuses: number;

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
  const attendanceRatio = computeAttendanceRatio(ctx.actualWorkDays, ctx.standardWorkDays);

  const r = computePayroll({
    baseSalary: ctx.baseSalary,
    attendanceRatio,
    performanceRatio: ctx.performanceRatio,
    goalRatio: ctx.goalRatio,
    weights: ctx.weights,
    totalTaxableAllowances: ctx.totalTaxableAllowances,
    totalNonTaxableAllowances: ctx.totalNonTaxableAllowances,
    overtimePay: ctx.overtimePay,
    totalBonuses: ctx.totalBonuses,
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

    totalDeductions: dec(r.totalDeductions),
    netSalary: dec(r.netSalary),

    leaveDays: ctx.leaveDays,
    status: 'draft',
    computedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Input resolution from the database.
// ---------------------------------------------------------------------------

function sumAllowances(
  rows: { type: string; amount: mongoose.Types.Decimal128; isTaxable: boolean }[],
  baseSalary: number,
): { taxable: number; nonTaxable: number } {
  let taxable = 0;
  let nonTaxable = 0;
  for (const a of rows) {
    const value = a.type === 'percentage' ? (baseSalary * toNum(a.amount)) / 100 : toNum(a.amount);
    if (a.isTaxable) taxable += value;
    else nonTaxable += value;
  }
  return { taxable: Math.round(taxable), nonTaxable: Math.round(nonTaxable) };
}

export interface RunOptions {
  /** Refuse to compute when the employee has no approved MonthlyEvaluation. */
  requireApprovedEvaluation?: boolean;
}

/** Resolve every input and build the context for one employee. */
async function resolveContext(
  period: PayrollPeriodDoc,
  employeeId: string,
  opts: RunOptions,
): Promise<PayrollRunContext> {
  const empId = new mongoose.Types.ObjectId(employeeId);

  const employee = await Employee.findById(employeeId).lean();
  if (!employee) throw new NotFoundError('Employee');

  // Active contract → base salary snapshot.
  const contract = await EmployeeContractModel.findOne({ employeeId, status: 'active' })
    .sort({ startDate: -1 })
    .lean();
  if (!contract) throw new NotFoundError('Active contract');
  const baseSalary = toNum(contract.baseSalary);

  // Salary policy in effect at the pay date.
  const policy = await SalaryPolicyConfig.findOne({ effectiveFrom: { $lte: period.payDate } })
    .sort({ effectiveFrom: -1 })
    .lean();
  if (!policy) throw new NotFoundError('Salary policy config');

  const multiplier = policy.insuranceCeilingMultiplier ?? 20;
  const policyBaseSalary = toNum(policy.baseSalary);
  const zoneWage = Number(
    (policy.regionalMinWage as Record<string, unknown> | undefined)?.[
      employee.salaryZone ?? 'zone1'
    ] ?? 0,
  );

  // Monthly evaluation → performance & goal ratios (60% + 20%).
  const evaluation = await MonthlyEvaluation.findOne({
    employeeId,
    payrollPeriodId: period._id,
  }).lean();
  const evalFinalized = evaluation?.status === 'approved' || evaluation?.status === 'acknowledged';
  if (opts.requireApprovedEvaluation !== false && !evalFinalized) {
    throw conflict(
      `MonthlyEvaluation not approved for employee ${employeeId} in period ${period.name}`,
      'PAY_EVAL_REQUIRED',
    );
  }

  // Attendance summary over the period.
  const summary = await aggregatePeriodAttendance(employeeId, period.startDate, period.endDate);

  // Tax profile in effect.
  const taxProfile = await EmployeeTaxProfile.findOne({
    employeeId,
    effectiveDate: { $lte: period.payDate },
  })
    .sort({ effectiveDate: -1 })
    .lean();

  // Allowances active during the period + bonuses for the period.
  const allowanceRows = await Allowance.find({
    employeeId,
    effectiveDate: { $lte: period.endDate },
    $or: [{ endDate: null }, { endDate: { $gte: period.startDate } }],
  }).lean();
  const allowances = sumAllowances(allowanceRows, baseSalary);

  const bonusRows = await Bonus.find({ employeeId, payrollPeriodId: period._id }).lean();
  const totalBonuses = Math.round(bonusRows.reduce((s, b) => s + toNum(b.amount), 0));

  return {
    payrollPeriodId: period._id as mongoose.Types.ObjectId,
    employeeId: empId,
    policyConfigId: policy._id as mongoose.Types.ObjectId,
    monthlyEvaluationId: (evaluation?._id as mongoose.Types.ObjectId) ?? null,

    standardWorkDays: period.standardWorkDays,
    actualWorkDays: summary.actualWorkDays,
    unpaidLeaveDays: summary.unpaidDays,
    workDays: summary.workedDays,
    leaveDays: summary.paidLeaveDays,

    performanceRatio: evaluation?.performanceRatio ?? 0,
    goalRatio: evaluation?.goalRatio ?? 0,
    weights: policy.salaryComponentWeights,

    baseSalary,
    totalTaxableAllowances: allowances.taxable,
    totalNonTaxableAllowances: allowances.nonTaxable,
    // OT is disabled by company policy (companyConfig.overtimeEnabled = false):
    // the OT engine (computeOvertimePay) exists but pay stays 0. To enable,
    // source OT hours per employee and call computeOvertimePay here.
    overtimePay: 0,
    totalBonuses,

    socialHealthCeiling: policyBaseSalary * multiplier,
    unemploymentCeiling: zoneWage * multiplier,
    personalDeduction: toNum(policy.personalDeduction),
    dependentDeduction: toNum(policy.dependentDeduction),
    dependentsCount: taxProfile?.dependentsCount ?? 0,
    taxBrackets: policy.taxBrackets as TaxBracket[] | undefined,
    insuranceRates: policy.insuranceRates as InsuranceRates | undefined,
    isResident: taxProfile?.isResident ?? true,
    nonResidentTaxRate: policy.nonResidentTaxRate,
  };
}

function assertPeriodOpen(period: PayrollPeriodDoc): void {
  if (period.status === 'closed' || period.status === 'paid') {
    throw conflict(
      `Payroll period ${period.name} is ${period.status} and cannot be run`,
      'PAY_PERIOD_LOCKED',
    );
  }
}

/**
 * Compute (or recompute) payroll for one employee in a period. Idempotent:
 * upserts the draft row; throws if the existing row is already approved/paid.
 */
export async function runPayrollForEmployee(
  periodId: string,
  employeeId: string,
  opts: RunOptions = {},
): Promise<IPayroll> {
  const period = await PayrollPeriod.findById(periodId);
  if (!period) throw new NotFoundError('Payroll period');
  assertPeriodOpen(period);

  const existing = await Payroll.findOne({ payrollPeriodId: periodId, employeeId }).lean();
  if (existing && existing.status !== 'draft') {
    throw conflict(
      `Payroll for employee ${employeeId} is ${existing.status}; recompute not allowed`,
      'PAY_ALREADY_FINALIZED',
    );
  }

  const ctx = await resolveContext(period, employeeId, opts);
  const doc = buildPayrollDoc(ctx);

  const session = await mongoose.startSession();
  try {
    let saved!: IPayroll;
    await session.withTransaction(async () => {
      const [row] = await Payroll.findOneAndUpdate(
        { payrollPeriodId: periodId, employeeId },
        { $set: doc },
        { upsert: true, new: true, session },
      ).then((d) => [d as unknown as IPayroll]);
      saved = row;
    });
    log.info({ action: 'run-employee', periodId, employeeId, net: doc.netSalary.toString() });
    return saved;
  } finally {
    await session.endSession();
  }
}

export interface PeriodRunResult {
  periodId: string;
  computed: number;
  errors: { employeeId: string; reason: string }[];
}

/**
 * Run payroll for every active employee in a period. Per-employee failures are
 * collected so one bad record doesn't abort the whole run.
 */
export async function runPayrollForPeriod(
  periodId: string,
  opts: RunOptions = {},
): Promise<PeriodRunResult> {
  const period = await PayrollPeriod.findById(periodId);
  if (!period) throw new NotFoundError('Payroll period');
  assertPeriodOpen(period);

  const employees = await Employee.find({ status: { $in: ['active', 'on_leave'] } })
    .select('_id')
    .lean();

  const result: PeriodRunResult = { periodId, computed: 0, errors: [] };
  for (const emp of employees) {
    const employeeId = String(emp._id);
    try {
      await runPayrollForEmployee(periodId, employeeId, opts);
      result.computed += 1;
    } catch (err) {
      result.errors.push({ employeeId, reason: (err as Error).message });
    }
  }

  log.info({ action: 'run-period', periodId, computed: result.computed, failed: result.errors.length });
  return result;
}
