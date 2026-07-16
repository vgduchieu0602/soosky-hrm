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
 *
 * Note: this application use-case constructs Decimal128/ObjectId persistence
 * values (money + id value types) — the payroll engine's output is inherently
 * persistence-shaped and is asserted on directly by the unit tests. All DB I/O
 * still flows through injected ports; `mongoose` is used only as a value-type
 * constructor here (like `Date`), never for queries.
 */
import mongoose from 'mongoose';

import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { logger } from '@core/logger/logger';
import { type IPayroll } from '@shared/models/payroll.model';
import { type SalaryComponentWeights } from '@shared/utils/salary.util';
import {
  buildPayrollDoc,
  type PayrollRunContext,
} from '@features/payroll/infrastructure/payroll-doc.mapper';
import type {
  PayrollPeriodRepository,
  PayrollRepository,
  EmployeeGateway,
  ContractGateway,
  ShiftGateway,
  SalaryPolicyGateway,
  EvaluationGateway,
  TaxProfileRepository,
  AllowanceRepository,
  BonusRepository,
  DeductionRepository,
  AttendanceGateway,
  WorkCalendarGateway,
  UnitOfWork,
  PeriodRecord,
  Id,
} from '@features/payroll/domain/ports';

// Re-export the engine's persistence-shaped mapper so callers/tests have one
// import site for the run engine.
export { buildPayrollDoc, type PayrollRunContext };

const log = logger.child({ feature: 'payroll', module: 'run' });

/** Probation contracts are paid this fraction of the agreed salary. */
const PROBATION_PAY_RATE = 0.85;

/** 409 conflict with a payroll-scoped error code. */
const conflict = (message: string, code = 'PAY_409') => new HttpError(409, message, code);

const toNum = (d: mongoose.Types.Decimal128 | number | null | undefined): number =>
  d == null ? 0 : Number(d.toString());

function sumAllowances(
  rows: { type: string; amount: mongoose.Types.Decimal128; isTaxable: boolean; isInsuranceBase?: boolean }[],
  baseSalary: number,
): { taxable: number; nonTaxable: number; insuranceBase: number } {
  let taxable = 0;
  let nonTaxable = 0;
  let insuranceBase = 0;
  for (const a of rows) {
    const value = a.type === 'percentage' ? (baseSalary * toNum(a.amount)) / 100 : toNum(a.amount);
    if (a.isTaxable) taxable += value;
    else nonTaxable += value;
    if (a.isInsuranceBase) insuranceBase += value;
  }
  return {
    taxable: Math.round(taxable),
    nonTaxable: Math.round(nonTaxable),
    insuranceBase: Math.round(insuranceBase),
  };
}

export interface RunOptions {
  /** Refuse to compute when the employee has no approved MonthlyEvaluation. */
  requireApprovedEvaluation?: boolean;
}

export interface PeriodRunResult {
  periodId: string;
  computed: number;
  errors: { employeeId: string; reason: string }[];
}

export class RunPayrollUseCases {
  constructor(
    private readonly periods: PayrollPeriodRepository,
    private readonly payrolls: PayrollRepository,
    private readonly employees: EmployeeGateway,
    private readonly contracts: ContractGateway,
    private readonly shifts: ShiftGateway,
    private readonly policies: SalaryPolicyGateway,
    private readonly evaluations: EvaluationGateway,
    private readonly taxProfiles: TaxProfileRepository,
    private readonly allowances: AllowanceRepository,
    private readonly bonuses: BonusRepository,
    private readonly deductions: DeductionRepository,
    private readonly attendance: AttendanceGateway,
    private readonly workCalendar: WorkCalendarGateway,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * Resolve every input and build the context for one CONTRACT line of an
   * employee within a period. `window` is the contract's active span clipped to
   * the period — attendance is counted only inside it, so a mid-month contract
   * change splits the days correctly. `isPrimary` (the latest contract) carries
   * the period-level allowances/bonuses/deductions so they aren't double-counted.
   */
  private async resolveContext(
    period: PeriodRecord,
    employeeId: string,
    contract: { _id: unknown; baseSalary: unknown; employmentStatus?: string },
    window: { start: Date; end: Date },
    isPrimary: boolean,
    opts: RunOptions,
  ): Promise<PayrollRunContext> {
    const empId = new mongoose.Types.ObjectId(employeeId);

    // Attendance must be locked before payroll consumes it, so figures can't shift
    // mid-run.
    if (!period.attendanceLockedAt) {
      throw conflict(`Hãy chốt chấm công kỳ ${period.name} trước khi tính lương`, 'PAY_ATT_NOT_LOCKED');
    }
    // Evaluations too: the 60/20 ratios must be frozen before they feed payroll,
    // mirroring the attendance lock.
    if (!period.evaluationLockedAt) {
      throw conflict(`Hãy chốt đánh giá kỳ ${period.name} trước khi tính lương`, 'PAY_EVAL_NOT_LOCKED');
    }

    const employee = await this.employees.findByIdLean(employeeId);
    if (!employee) throw new NotFoundError('Employee');

    // Per-employee standard working days: derive from the employee's assigned
    // shift's working week (minus holidays); fall back to the period default.
    // The FULL-month standard is used for every contract line (each line's days
    // are its own slice), matching the payslip layout.
    let standardWorkDays = period.standardWorkDays;
    if (employee.shiftId) {
      const workingDays = await this.shifts.workingDays(String(employee.shiftId));
      if (workingDays?.length) {
        const computed = await this.workCalendar.standardWorkDaysInRange(
          period.startDate,
          period.endDate,
          workingDays,
        );
        if (computed > 0) standardWorkDays = computed;
      }
    }

    const baseSalary = toNum(contract.baseSalary as mongoose.Types.Decimal128);

    // Salary policy in effect at the pay date.
    const policy = await this.policies.effectiveAt(period.payDate);
    if (!policy) throw new NotFoundError('Salary policy config');

    const multiplier = policy.insuranceCeilingMultiplier ?? 20;
    const policyBaseSalary = toNum(policy.baseSalary);
    const zoneWage = Number(
      (policy.regionalMinWage as Record<string, unknown> | undefined)?.[employee.salaryZone ?? 'zone1'] ?? 0,
    );

    // Monthly evaluation → performance & goal ratios (60% + 20%).
    const evaluation = await this.evaluations.findForEmployeePeriod(employeeId, String(period._id));
    const evalFinalized = evaluation?.status === 'approved' || evaluation?.status === 'acknowledged';
    if (opts.requireApprovedEvaluation !== false && !evalFinalized) {
      throw conflict(
        `MonthlyEvaluation not approved for employee ${employeeId} in period ${period.name}`,
        'PAY_EVAL_REQUIRED',
      );
    }

    // Attendance summary over this contract's window (clipped to the period).
    const summary = await this.attendance.aggregatePeriod(employeeId, window.start, window.end);

    // Employment status (tình trạng, not loại HĐLĐ) decides pay base + insurance.
    // ALL types (intern / probation / official) use the SAME 20/60/20 split
    // (chấm công + hiệu suất + mục tiêu). Status only changes:
    //   • probation → base is a fraction (probationPayRate, default 85%)
    //   • intern/probation → exempt from compulsory insurance (BHXH) + union fee
    //   • official → full base + insurance on the fixed company salary + union fee
    const isIntern = contract.employmentStatus === 'internship';
    const isProbation = contract.employmentStatus === 'probation';
    const isInsuranceExempt = isIntern || isProbation;

    const probationRate = (policy.probationPayRate ?? PROBATION_PAY_RATE * 100) / 100;
    // Probation is paid a fraction of the agreed salary; intern/official get full.
    const effectiveBase = isProbation ? Math.round(baseSalary * probationRate) : baseSalary;

    const fixedInsuranceSalary = toNum(policy.socialInsuranceSalary) || baseSalary;
    const insuranceBaseSalary = isInsuranceExempt ? 0 : fixedInsuranceSalary;
    const unionFee =
      !isInsuranceExempt && policy.unionFeeEnabled
        ? Math.round((fixedInsuranceSalary * (policy.unionFeeRate ?? 0)) / 100)
        : 0;

    // Tax profile in effect.
    const taxProfile = await this.taxProfiles.findEffective(employeeId, period.payDate);

    // Allowances active during the period + bonuses for the period.
    const allowanceRows = await this.allowances.findActiveForPeriod(
      employeeId,
      period.startDate,
      period.endDate,
    );
    const allowances = sumAllowances(
      allowanceRows as unknown as {
        type: string;
        amount: mongoose.Types.Decimal128;
        isTaxable: boolean;
        isInsuranceBase?: boolean;
      }[],
      baseSalary,
    );

    const bonusRows = await this.bonuses.findForPeriod(employeeId, String(period._id));
    const totalBonuses = Math.round(bonusRows.reduce((s, b) => s + toNum(b.amount), 0));
    const totalNonTaxableBonuses = Math.round(
      bonusRows.filter((b) => b.isTaxable === false).reduce((s, b) => s + toNum(b.amount), 0),
    );

    // Post-tax deductions: one-off for this period + active recurring ones.
    const deductionRows = await this.deductions.findActiveForPeriod(
      employeeId,
      String(period._id),
      period.startDate,
      period.endDate,
    );
    const deductions = deductionRows.map((d) => ({
      type: d.type as 'fixed' | 'percentage',
      amount: toNum(d.amount),
    }));

    // Period-level allowances/bonuses/deductions belong on ONE line only (the
    // latest contract) so a split month doesn't count them twice.
    const allowTaxable = isPrimary ? allowances.taxable : 0;
    const allowNonTaxable = isPrimary ? allowances.nonTaxable : 0;
    const allowInsuranceBase = isPrimary ? allowances.insuranceBase : 0;
    const bonusesTotal = isPrimary ? totalBonuses : 0;
    const bonusesNonTaxable = isPrimary ? totalNonTaxableBonuses : 0;
    const deductionsForLine = isPrimary ? deductions : [];

    return {
      payrollPeriodId: period._id as mongoose.Types.ObjectId,
      employeeId: empId,
      contractId: contract._id as mongoose.Types.ObjectId,
      policyConfigId: policy._id as mongoose.Types.ObjectId,
      monthlyEvaluationId: (evaluation?._id as mongoose.Types.ObjectId) ?? null,

      standardWorkDays,
      actualWorkDays: summary.actualWorkDays,
      unpaidLeaveDays: summary.unpaidDays,
      workDays: summary.workedDays,
      leaveDays: summary.paidLeaveDays,

      performanceRatio: evaluation?.performanceRatio ?? 0,
      goalRatio: evaluation?.goalRatio ?? 0,
      // Every employment type uses the policy 20/60/20 split.
      weights: policy.salaryComponentWeights as SalaryComponentWeights | undefined,
      // Business rule (PAYROLL-FORMULA §1): unpaid absence reduces the WHOLE
      // salary — perf/goal components scale by attendance too. Policy-driven,
      // default true; irrelevant for intern/probation (perf/goal weights = 0).
      prorateByAttendance: policy.prorateByAttendance !== false,

      baseSalary: effectiveBase,
      totalTaxableAllowances: allowTaxable,
      totalNonTaxableAllowances: allowNonTaxable,
      insuranceBaseSalary,
      // Allowances flagged isInsuranceBase add to the BHXH base — except for
      // intern/probation, who are not on compulsory insurance.
      insuranceBaseAllowances: isInsuranceExempt ? 0 : allowInsuranceBase,
      // Fixed BHXH amount entered by HR on the tax profile overrides the %-based
      // computation. Intern/probation are insurance-exempt → 0.
      fixedInsuranceAmount: isInsuranceExempt ? 0 : (taxProfile?.insuranceAmount ?? 0),
      unionFee,
      deductions: deductionsForLine,
      // OT is disabled by company policy (companyConfig.overtimeEnabled = false):
      // the OT engine (computeOvertimePay) exists but pay stays 0. To enable,
      // source OT hours per employee and call computeOvertimePayBreakdown here,
      // feeding `.total` to overtimePay and `.nonTaxable` to overtimeNonTaxablePay.
      overtimePay: 0,
      overtimeNonTaxablePay: 0,
      totalBonuses: bonusesTotal,
      totalNonTaxableBonuses: bonusesNonTaxable,

      socialHealthCeiling: policyBaseSalary * multiplier,
      unemploymentCeiling: zoneWage * multiplier,
      personalDeduction: toNum(policy.personalDeduction),
      dependentDeduction: toNum(policy.dependentDeduction),
      dependentsCount: taxProfile?.dependentsCount ?? 0,
      taxBrackets: policy.taxBrackets as PayrollRunContext['taxBrackets'],
      insuranceRates: policy.insuranceRates as PayrollRunContext['insuranceRates'],
      isResident: taxProfile?.isResident ?? true,
      nonResidentTaxRate: policy.nonResidentTaxRate,
    };
  }

  private assertPeriodOpen(period: PeriodRecord): void {
    if (period.status === 'closed' || period.status === 'paid') {
      throw conflict(
        `Payroll period ${period.name} is ${period.status} and cannot be run`,
        'PAY_PERIOD_LOCKED',
      );
    }
  }

  /**
   * Compute (or recompute) payroll for one employee in a period. If more than
   * one contract is active during the period (a mid-month change), one payslip
   * LINE is produced per contract — attendance days split by each contract's
   * window. Idempotent per (period, employee, contract); refuses to touch a
   * line already approved/paid. Returns the primary (latest contract) line.
   */
  async forEmployee(periodId: string, employeeId: string, opts: RunOptions = {}): Promise<IPayroll> {
    const period = await this.periods.findById(periodId);
    if (!period) throw new NotFoundError('Payroll period');
    this.assertPeriodOpen(period);

    // All contracts whose active window intersects the period, oldest → newest.
    const contracts = await this.contracts.findOverlapping(employeeId, period.startDate, period.endDate);
    if (contracts.length === 0) throw new NotFoundError('Active contract');

    const pStart = period.startDate.getTime();
    const pEnd = period.endDate.getTime();
    const lastIdx = contracts.length - 1;

    let primary: IPayroll | null = null;
    for (let i = 0; i < contracts.length; i += 1) {
      const c = contracts[i] as unknown as {
        _id: unknown; baseSalary: unknown; employmentStatus?: string; startDate: Date; endDate?: Date | null;
      };
      // Refuse to recompute a finalized line for this contract.
      const existing = await this.payrolls.findExisting(periodId, employeeId, String(c._id));
      if (existing && existing.status !== 'draft') {
        throw conflict(
          `Payroll for employee ${employeeId} is ${existing.status}; recompute not allowed`,
          'PAY_ALREADY_FINALIZED',
        );
      }
      // Clip the contract span to the period → this line's attendance window.
      const wStart = new Date(Math.max(c.startDate.getTime(), pStart));
      const wEnd = new Date(c.endDate ? Math.min(new Date(c.endDate).getTime(), pEnd) : pEnd);
      const ctx = await this.resolveContext(period, employeeId, c, { start: wStart, end: wEnd }, i === lastIdx, opts);
      const doc = buildPayrollDoc(ctx);
      const saved = await this.uow.withTransaction((tx) =>
        this.payrolls.upsertComputed(periodId, employeeId, doc, tx),
      );
      log.info({ action: 'run-employee', periodId, employeeId, contractId: String(c._id), net: doc.netSalary.toString() });
      primary = saved;
    }
    return primary!;
  }

  /**
   * Run payroll for every active employee in a period. Per-employee failures are
   * collected so one bad record doesn't abort the whole run.
   */
  async forPeriod(periodId: string, opts: RunOptions = {}): Promise<PeriodRunResult> {
    const period = await this.periods.findById(periodId);
    if (!period) throw new NotFoundError('Payroll period');
    this.assertPeriodOpen(period);

    const employees = await this.employees.listForRun();

    const result: PeriodRunResult = { periodId, computed: 0, errors: [] };
    for (const emp of employees) {
      const employeeId = String(emp._id);
      try {
        await this.forEmployee(periodId, employeeId, opts);
        result.computed += 1;
      } catch (err) {
        result.errors.push({ employeeId, reason: (err as Error).message });
      }
    }

    log.info({ action: 'run-period', periodId, computed: result.computed, failed: result.errors.length });
    return result;
  }
}
