/**
 * Payroll Run engine — resolves every input for an employee in a period, runs
 * the pure `computePayroll` chain, and upserts a Payroll record.
 *
 *   hợp đồng chồng kỳ ─▶ chia ĐOẠN LƯƠNG ─┐
 *   chấm công + lịch làm việc (theo đoạn) ─┤
 *   monthlyEvaluation (theo KỲ)           ├─▶ computePayroll() ─▶ buildPayrollDoc()
 *   salaryPolicyConfig                    │                        ─▶ upsert Payroll
 *   taxProfile · allowances/bonuses ──────┘
 *
 * Một kỳ có thể trải trên NHIỀU hợp đồng (thử việc → chính thức, đổi mức lương
 * giữa tháng). Mỗi đoạn có mức lương, tỷ lệ hưởng và ngày công riêng; thành phần
 * lương tính riêng từng đoạn rồi cộng lại. Phụ cấp/thưởng/khấu trừ/thuế/bảo hiểm
 * vẫn ở mức KỲ — quy định hiện hành chưa yêu cầu chia nhỏ.
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
import { logger } from '@infra/logger/logger';
import { type IPayroll } from '@shared/models/payroll.model';
import { DEFAULT_COMPONENT_WEIGHTS, type SalaryComponentWeights } from '@modules/hrm/core/payroll/domain/salary.util';
import {
  buildContractSegments,
  describeGap,
  describeOverlap,
  effectivePayrollRange,
  type ContractSegment,
} from '@features/payroll/domain/contract-segment';
import {
  buildPayrollDoc,
  type PayrollRunContext,
  type PayrollSegmentInput,
} from '@features/payroll/infrastructure/payroll-doc.mapper';
import type { PeriodRecord, PeriodReader, PeriodLifecycle } from '@features/period/domain/ports';
import type {
  PayrollRepository,
  EmployeeGateway,
  ContractGateway,
  ContractRecord,
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
  Id,
  Clock,
} from '@features/payroll/domain/ports';

// Re-export the engine's persistence-shaped mapper so callers/tests have one
// import site for the run engine.
export { buildPayrollDoc, type PayrollRunContext };

const log = logger.child({ feature: 'payroll', module: 'run' });

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

/** Đoạn lương đã có ngày công chuẩn + ngày công thực tế của riêng nó. */
interface ResolvedSegment extends ContractSegment {
  standardWorkDays: number;
  actualWorkDays: number;
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
    private readonly periodReader: PeriodReader,
  private readonly periodLifecycle: PeriodLifecycle,
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
    private readonly clock: Clock,
  ) {}

  /**
   * Chia kỳ thành các đoạn lương và giải ngày công / chấm công cho từng đoạn.
   *
   * @throws HttpError 409 `PAY_CONTRACT_OVERLAP` khi hai hợp đồng cùng phủ một
   *   khoảng ngày — payroll không được tự đoán hợp đồng nào đúng.
   * @throws HttpError 409 `PAY_CONTRACT_GAP` khi có khoảng trống KẸP GIỮA hai
   *   hợp đồng mà khoảng đó còn ngày công thật.
   */
  private async resolveSegments(
    period: PeriodRecord,
    scope: { startDate: Date; endDate: Date },
    employeeId: string,
    contractRows: ContractRecord[],
  ): Promise<{ segments: ResolvedSegment[] }> {
    // Chia đoạn trong PHẠM VI THUỘC BẢNG LƯƠNG, không phải toàn bộ kỳ.
    const { segments, overlaps, gaps } = buildContractSegments(
      contractRows.map((c) => ({
        contractId: String((c as { _id: unknown })._id),
        startDate: c.startDate,
        endDate: c.endDate ?? null,
        employmentStatus: c.employmentStatus,
        baseSalary: toNum(c.baseSalary),
      })),
      scope,
    );

    if (overlaps.length > 0) {
      throw conflict(
        `Hợp đồng của nhân viên ${employeeId} bị chồng ngày trong kỳ ${period.name}: ` +
          overlaps.map(describeOverlap).join('; '),
        'PAY_CONTRACT_OVERLAP',
      );
    }

    const workingDays = await this.employeeWorkingDays(employeeId);

    // Khoảng trống chỉ rơi vào thứ Bảy/Chủ nhật/ngày lễ thì không phải lỗi dữ
    // liệu đáng chặn — chỉ chặn khi khoảng đó thực sự có ngày công.
    for (const gap of gaps) {
      const gapWorkDays = await this.workCalendar.standardWorkDaysInRange(gap.from, gap.to, workingDays);
      if (gapWorkDays > 0) {
        throw conflict(
          `Nhân viên ${employeeId} thiếu hợp đồng trong kỳ ${period.name}: ${describeGap(gap)} ` +
            `(${gapWorkDays} ngày công)`,
          'PAY_CONTRACT_GAP',
        );
      }
    }

    const resolved: ResolvedSegment[] = [];
    for (const segment of segments) {
      // Dùng lại đúng hạ tầng lịch làm việc + chấm công, chỉ thu hẹp khoảng —
      // không chia theo ngày dương lịch, không truy vấn từng ngày.
      const [standardWorkDays, summary] = await Promise.all([
        this.workCalendar.standardWorkDaysInRange(segment.from, segment.to, workingDays),
        this.attendance.aggregatePeriod(employeeId, segment.from, segment.to),
      ]);
      resolved.push({
        ...segment,
        standardWorkDays,
        actualWorkDays: summary.actualWorkDays,
      });
    }

    return { segments: resolved };
  }

  /** Ngày làm việc trong tuần theo ca của nhân viên (rỗng = lịch chung). */
  private async employeeWorkingDays(employeeId: string): Promise<number[] | undefined> {
    const employee = await this.employees.findByIdLean(employeeId);
    if (!employee?.shiftId) return undefined;
    const workingDays = await this.shifts.workingDays(String(employee.shiftId));
    return workingDays?.length ? workingDays : undefined;
  }

  /** Resolve every input and build the context for one employee. */
  private async resolveContext(
    period: PeriodRecord,
    employeeId: string,
    opts: RunOptions,
  ): Promise<PayrollRunContext> {
    const empId = new mongoose.Types.ObjectId(employeeId);

    // Attendance must be locked before payroll consumes it, so figures can't shift
    // mid-run.
    if (!period.attendanceLockedAt) {
      throw conflict(`Hãy chốt chấm công kỳ ${period.name} trước khi tính lương`, 'PAY_ATTENDANCE_NOT_LOCKED');
    }
    if (!period.performanceLockedAt) {
      throw conflict(`Hãy chốt đánh giá kỳ ${period.name} trước khi tính lương`, 'PAY_PERFORMANCE_NOT_LOCKED');
    }

    const employee = await this.employees.findByIdLean(employeeId);
    if (!employee) throw new NotFoundError('Employee');

    // Per-employee standard working days: derive from the employee's assigned
    // shift's working week (minus holidays); fall back to the period default.
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

    // Chỉ xét phần kỳ mà người này THỰC SỰ là nhân viên. Người vào làm ngày 15
    // không "thiếu hợp đồng" cho 01–14 — lúc đó họ chưa thuộc bảng lương.
    const scope = effectivePayrollRange(period, {
      from: employee.hireDate,
      to: employee.terminationDate ?? null,
    });
    if (!scope) {
      throw conflict(
        `Nhân viên ${employeeId} không thuộc kỳ ${period.name} (vào làm/nghỉ việc ngoài khoảng kỳ)`,
        'PAY_OUT_OF_SCOPE',
      );
    }

    // Hợp đồng theo NGÀY HIỆU LỰC (không theo `status`): một kỳ có thể trải trên
    // nhiều hợp đồng, và hợp đồng đã hết hiệu lực vẫn đúng cho đoạn quá khứ.
    const contractRows = await this.contracts.findOverlapping(
      employeeId,
      scope.startDate,
      scope.endDate,
    );
    if (contractRows.length === 0) throw new NotFoundError('Active contract');

    const { segments: rawSegments } = await this.resolveSegments(
      period,
      scope,
      employeeId,
      contractRows,
    );

    // Mức lương của đoạn CUỐI kỳ — dùng để hiển thị và làm nền bảo hiểm dự
    // phòng. Phần tính toán lấy từ từng đoạn, không lấy từ đây.
    const lastSegment = rawSegments[rawSegments.length - 1]!;
    const baseSalary = lastSegment.baseSalary;

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

    // Attendance summary over the period.
    const summary = await this.attendance.aggregatePeriod(employeeId, period.startDate, period.endDate);

    // Tình trạng làm việc (không phải loại HĐLĐ) quyết định cách trả và bảo hiểm:
    //   • internship → mức cố định từ salary policy, chỉ chia theo chấm công, KHÔNG bảo hiểm.
    //   • probation  → `probationPayRate` × lương hợp đồng, KHÔNG bảo hiểm.
    //   • official   → đủ lương, áp trọng số chấm công/hiệu suất/mục tiêu từ
    //                  chính sách, đóng bảo hiểm trên mức cố định + phí công đoàn.
    // Trạng thái này nay xét theo TỪNG ĐOẠN, không còn lấy từ một hợp đồng duy
    // nhất — kỳ có chuyển thử việc → chính thức phải ra hai khoản khác nhau.
    const probationRate = policy.probationPayRate / 100;
    const internPayAmount = toNum(policy.internStipend);
    const policyWeights = policy.salaryComponentWeights as SalaryComponentWeights | undefined;

    const segments: PayrollSegmentInput[] = rawSegments.map((segment) => {
      const isOfficial = segment.employmentStatus === 'official';
      const effectiveSalaryBase =
        segment.employmentStatus === 'internship' ? internPayAmount : segment.baseSalary *
          (segment.employmentStatus === 'probation' ? probationRate : 1);
      return {
        contractId: new mongoose.Types.ObjectId(segment.contractId),
        from: segment.from,
        to: segment.to,
        employmentStatus: segment.employmentStatus,
        baseSalary: segment.baseSalary,
        payRate: segment.employmentStatus === 'probation' ? probationRate : 1,
        effectiveSalaryBase,
        standardWorkDays: segment.standardWorkDays,
        actualWorkDays: segment.actualWorkDays,
        // Đánh giá gắn với KỲ, không gắn với hợp đồng: cùng một
        // performanceRatio/goalRatio dùng lại cho mọi đoạn chính thức.
        performanceRatio: isOfficial ? (evaluation?.performanceRatio ?? 0) : 0,
        goalRatio: isOfficial ? (evaluation?.goalRatio ?? 0) : 0,
        // Thực tập/thử việc chỉ ăn theo chấm công → dồn 100% vào trọng số chấm công.
        weights: isOfficial
          ? (policyWeights ?? DEFAULT_COMPONENT_WEIGHTS)
          : { attendance: 100, performance: 0, goal: 0 },
      };
    });

    // Miễn bảo hiểm khi CẢ KỲ không có đoạn chính thức nào. Có ít nhất một đoạn
    // chính thức thì vẫn thu theo mức của kỳ (không chia nhỏ) — quy định hiện
    // hành chưa yêu cầu chia tỷ lệ bảo hiểm theo ngày.
    const isInsuranceExempt = !rawSegments.some((s) => s.employmentStatus === 'official');

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

    return {
      payrollPeriodId: period._id as mongoose.Types.ObjectId,
      employeeId: empId,
      policyConfigId: policy._id as mongoose.Types.ObjectId,
      monthlyEvaluationId: (evaluation?._id as mongoose.Types.ObjectId) ?? null,

      standardWorkDays,
      actualWorkDays: summary.actualWorkDays,
      unpaidLeaveDays: summary.unpaidDays,
      workDays: summary.workedDays,
      leaveDays: summary.paidLeaveDays,

      performanceRatio: evaluation?.performanceRatio ?? 0,
      goalRatio: evaluation?.goalRatio ?? 0,
      weights: policyWeights,

      segments,
      // Ảnh chụp: chép lại đúng những đầu vào QUYẾT ĐỊNH con số của kỳ này. Sau
      // khi công ty đổi trọng số / mức đóng BHXH / hợp đồng / đánh giá, phiếu
      // lương cũ vẫn giải thích được bằng chính dữ liệu đã dùng lúc tính.
      snapshot: {
        period: {
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          payDate: period.payDate,
        },
        employment: {
          hireDate: employee.hireDate,
          terminationDate: employee.terminationDate ?? null,
          effectiveStart: scope.startDate,
          effectiveEnd: scope.endDate,
        },
        evaluation: {
          status: evaluation?.status ?? null,
          // Evaluation owns the definition snapshot. Never consult current
          // PerformanceCriterion rows while explaining historical payroll.
          criteria: (() => {
            const definitions = new Map(
              (evaluation?.criteriaDefinitionSnapshot ?? []).map((definition) => [
                String(definition.criterionId),
                definition,
              ]),
            );
            return (evaluation?.criteriaScores ?? []).map((score) => {
              const definition = definitions.get(String(score.criterionId));
              return {
                criterionId: score.criterionId as mongoose.Types.ObjectId,
                ...(definition
                  ? { name: definition.name, group: definition.group, weight: definition.weight }
                  : {}),
                score: score.score,
              };
            });
          })(),
        },
        policy: {
          effectiveFrom: policy.effectiveFrom ?? null,
          internPayAmount,
          probationPayRate: policy.probationPayRate,
          socialInsuranceSalary: fixedInsuranceSalary,
          unionFeeRate: policy.unionFeeRate ?? 0,
          unionFeeEnabled: policy.unionFeeEnabled ?? false,
        },
        insuranceExempt: isInsuranceExempt,
      },
      baseSalary,
      totalTaxableAllowances: allowances.taxable,
      totalNonTaxableAllowances: allowances.nonTaxable,
      insuranceBaseSalary,
      // Allowances flagged isInsuranceBase add to the BHXH base — except for
      // intern/probation, who are not on compulsory insurance.
      insuranceBaseAllowances: isInsuranceExempt ? 0 : allowances.insuranceBase,
      // EmployeeTaxProfile is the only fixed-insurance source today. `??` keeps
      // an explicit employee override of 0; intern/probation are exempt → 0.
      fixedInsuranceAmount: isInsuranceExempt ? 0 : (taxProfile?.insuranceAmount ?? 0),
      unionFee,
      deductions,
      // OT is disabled by company policy (companyConfig.overtimeEnabled = false):
      // the OT engine (computeOvertimePay) exists but pay stays 0. To enable,
      // source OT hours per employee and call computeOvertimePayBreakdown here,
      // feeding `.total` to overtimePay and `.nonTaxable` to overtimeNonTaxablePay.
      overtimePay: 0,
      overtimeNonTaxablePay: 0,
      totalBonuses,
      totalNonTaxableBonuses,

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

  private assertSourcesLocked(period: PeriodRecord): void {
    if (!period.attendanceLockedAt) {
      throw conflict(`Hãy chốt chấm công kỳ ${period.name} trước khi tính lương`, 'PAY_ATTENDANCE_NOT_LOCKED');
    }
    if (!period.performanceLockedAt) {
      throw conflict(`Hãy chốt đánh giá kỳ ${period.name} trước khi tính lương`, 'PAY_PERFORMANCE_NOT_LOCKED');
    }
  }

  /**
   * Compute (or recompute) payroll for one employee in a period. Idempotent:
   * upserts the draft row; throws if the existing row is already approved/paid.
   */
  async forEmployee(periodId: string, employeeId: string, opts: RunOptions = {}): Promise<IPayroll> {
    const period = await this.periodReader.findById(periodId);
    if (!period) throw new NotFoundError('Payroll period');
    this.assertPeriodOpen(period);
    this.assertSourcesLocked(period);

    const existing = await this.payrolls.findExisting(periodId, employeeId);
    if (existing && existing.status !== 'draft') {
      throw conflict(
        `Payroll for employee ${employeeId} is ${existing.status}; recompute not allowed`,
        'PAY_ALREADY_FINALIZED',
      );
    }

    const ctx = await this.resolveContext(period, employeeId, opts);
    const doc = buildPayrollDoc(ctx);

    const saved = await this.uow.withTransaction((tx) =>
      this.payrolls.upsertComputed(periodId, employeeId, doc, tx),
    );
    log.info({ action: 'run-employee', periodId, employeeId, net: doc.netSalary.toString() });
    return saved;
  }

  /**
   * Run payroll for every active employee in a period. Per-employee failures are
   * collected so one bad record doesn't abort the whole run.
   */
  async forPeriod(periodId: string, opts: RunOptions = {}): Promise<PeriodRunResult> {
    const period = await this.periodReader.findById(periodId);
    if (!period) throw new NotFoundError('Payroll period');
    this.assertPeriodOpen(period);
    this.assertSourcesLocked(period);

    const employees = await this.employees.listForRun(period.startDate, period.endDate);

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
