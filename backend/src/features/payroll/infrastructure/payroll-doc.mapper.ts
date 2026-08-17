/**
 * Persistence mapper for the payroll run engine: turns fully-resolved numeric
 * inputs into a Mongoose-shaped Payroll document (money as Decimal128). Kept in
 * infrastructure because it constructs Decimal128/ObjectId persistence values;
 * the pure numeric engine it delegates to lives in `@shared/utils/salary.util`.
 */
import mongoose from 'mongoose';

import { type IPayroll, type IPayrollCalculationSnapshot } from '@shared/models/payroll.model';
import {
  computeAttendanceRatio,
  computeEffectiveBaseSalary,
  computePayroll,
  DEFAULT_COMPONENT_WEIGHTS,
  type EffectiveBaseResult,
  type SalaryComponentWeights,
  type TaxBracket,
  type InsuranceRates,
} from '@shared/utils/salary.util';

/** Hình dạng ảnh chụp hiện tại. Tăng khi cấu trúc đổi. */
export const PAYROLL_SNAPSHOT_VERSION = 2;

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(Math.round(n)));
const copyDate = (value: Date) => new Date(value.getTime());

/**
 * Một đoạn lương đã giải xong mọi đầu vào số học.
 *
 * Kỳ lương trải trên nhiều hợp đồng thì mỗi đoạn có mức lương, tỷ lệ hưởng và
 * ngày công riêng; thành phần lương được tính RIÊNG cho từng đoạn rồi cộng lại.
 */
export interface PayrollSegmentInput {
  contractId: mongoose.Types.ObjectId;
  from: Date;
  to: Date;
  employmentStatus: string;
  /** Lương ghi trên hợp đồng của đoạn này. */
  baseSalary: number;
  /** Tỷ lệ hưởng: 1 với chính thức/thực tập, `probationPayRate` với thử việc. */
  payRate: number;
  /** Salary basis resolved by employment policy before component calculation. */
  effectiveSalaryBase?: number;
  standardWorkDays: number;
  actualWorkDays: number;
  /** Thử việc/thực tập = 0 theo quy định hiện hành. */
  performanceRatio: number;
  goalRatio: number;
  weights: SalaryComponentWeights;
}

/**
 * Những sự thật nguồn CHỈ ảnh chụp mới cần — phần còn lại của ảnh chụp lấy thẳng
 * từ các trường đã có trong `PayrollRunContext`, không truyền hai lần.
 */
export interface PayrollSnapshotSource {
  period: { name: string; startDate: Date; endDate: Date; payDate: Date };
  employment: {
    hireDate: Date;
    terminationDate?: Date | null;
    /** Phạm vi thuộc bảng lương sau khi kẹp theo ngày vào làm / nghỉ việc. */
    effectiveStart: Date;
    effectiveEnd: Date;
  };
  evaluation: {
    status?: string | null;
    criteria: {
      criterionId: mongoose.Types.ObjectId;
      name?: string;
      group?: 'performance' | 'goal';
      weight?: number;
      score: number;
    }[];
  };
  policy: {
    effectiveFrom?: Date | null;
    internPayAmount: number;
    probationPayRate: number;
    socialInsuranceSalary: number;
    unionFeeRate: number;
    unionFeeEnabled: boolean;
  };
  /** Cả kỳ không có đoạn chính thức nào → miễn bảo hiểm bắt buộc. */
  insuranceExempt: boolean;
}

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

  /**
   * Các đoạn lương của kỳ. Luôn có ít nhất một phần tử. Khi chỉ có một đoạn phủ
   * cả kỳ, kết quả trùng khít cách tính cũ.
   */
  segments: PayrollSegmentInput[];

  /** Đầu vào nguồn để dựng ảnh chụp bất biến của kỳ. */
  snapshot: PayrollSnapshotSource;

  /**
   * Lương hợp đồng dùng để HIỂN THỊ và làm nền bảo hiểm dự phòng — theo quy ước
   * là mức của đoạn CUỐI kỳ. Khi có nhiều hợp đồng, một con số duy nhất không
   * mô tả hết kỳ; phần tính toán lấy từ `segments`, không lấy từ đây.
   */
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

/**
 * Tính thành phần lương cho từng đoạn rồi cộng lại.
 *
 * Mỗi đoạn có tỷ lệ chấm công riêng (ngày công thực tế / ngày công chuẩn CỦA
 * ĐOẠN ĐÓ), nên chuyển thử việc → chính thức giữa kỳ ra đúng hai khoản, không
 * còn chuyện lấy mức lương cuối kỳ nhân cho cả tháng.
 */
function computeSegments(segments: PayrollSegmentInput[]): {
  total: EffectiveBaseResult;
  perSegment: (EffectiveBaseResult & { attendanceRatio: number })[];
} {
  const perSegment = segments.map((segment) => {
    const attendanceRatio = Math.min(
      1,
      computeAttendanceRatio(segment.actualWorkDays, segment.standardWorkDays),
    );
    const result = computeEffectiveBaseSalary({
      baseSalary: Math.round(segment.effectiveSalaryBase ?? segment.baseSalary * segment.payRate),
      attendanceRatio,
      performanceRatio: segment.performanceRatio,
      goalRatio: segment.goalRatio,
      weights: segment.weights,
    });
    return { ...result, attendanceRatio };
  });

  const total = perSegment.reduce<EffectiveBaseResult>(
    (sum, s) => ({
      attendanceComponent: sum.attendanceComponent + s.attendanceComponent,
      performanceComponent: sum.performanceComponent + s.performanceComponent,
      goalComponent: sum.goalComponent + s.goalComponent,
      proRatedBaseSalary: sum.proRatedBaseSalary + s.proRatedBaseSalary,
    }),
    { attendanceComponent: 0, performanceComponent: 0, goalComponent: 0, proRatedBaseSalary: 0 },
  );

  return { total, perSegment };
}

/** Map resolved inputs onto a Payroll document (money as Decimal128). Pure. */
export function buildPayrollDoc(ctx: PayrollRunContext): IPayroll {
  // Cap at 1: working more days than the period standard must not inflate the
  // 20% attendance component beyond full.
  const attendanceRatio = Math.min(1, computeAttendanceRatio(ctx.actualWorkDays, ctx.standardWorkDays));

  const segments = computeSegments(ctx.segments);

  // Từng đoạn ở dạng lưu trữ — đủ để dựng lại con số của đoạn mà không tra hợp
  // đồng hay chính sách hiện tại.
  const contractSegments = ctx.segments.map((segment, i) => ({
    contractId: segment.contractId,
    from: copyDate(segment.from),
    to: copyDate(segment.to),
    employmentStatus: segment.employmentStatus,
    baseSalary: dec(segment.baseSalary),
    payRate: segment.payRate,
    effectiveSalaryBase: dec(segment.effectiveSalaryBase ?? segment.baseSalary * segment.payRate),
    standardWorkDays: segment.standardWorkDays,
    actualWorkDays: segment.actualWorkDays,
    weights: { ...segment.weights },
    performanceRatio: segment.performanceRatio,
    goalRatio: segment.goalRatio,
    attendanceComponent: dec(segments.perSegment[i]!.attendanceComponent),
    performanceComponent: dec(segments.perSegment[i]!.performanceComponent),
    goalComponent: dec(segments.perSegment[i]!.goalComponent),
    segmentSalary: dec(segments.perSegment[i]!.proRatedBaseSalary),
  }));

  const r = computePayroll({
    baseSalary: ctx.baseSalary,
    attendanceRatio,
    performanceRatio: ctx.performanceRatio,
    goalRatio: ctx.goalRatio,
    weights: ctx.weights,
    components: segments.total,
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

  const calculatedAt = new Date();
  const src = ctx.snapshot;

  /**
   * Ảnh chụp: ID để truy vết + GIÁ TRỊ ĐÃ DÙNG để làm sự thật lịch sử.
   *
   * Phần `totals` lặp lại các con số đã có ở cấp bản ghi. Cố ý: ảnh chụp phải tự
   * giải thích được khi đọc riêng, và cả hai cùng dựng từ một biến `r` trong một
   * lần gọi nên không thể lệch nhau.
   */
  const calculationSnapshot: IPayrollCalculationSnapshot = {
    version: PAYROLL_SNAPSHOT_VERSION,

    period: {
      name: src.period.name,
      startDate: copyDate(src.period.startDate),
      endDate: copyDate(src.period.endDate),
      payDate: copyDate(src.period.payDate),
    },
    employment: {
      hireDate: copyDate(src.employment.hireDate),
      terminationDate: src.employment.terminationDate ? copyDate(src.employment.terminationDate) : null,
      effectiveStart: copyDate(src.employment.effectiveStart),
      effectiveEnd: copyDate(src.employment.effectiveEnd),
    },

    contracts: contractSegments,

    attendance: {
      standardWorkDays: ctx.standardWorkDays,
      actualWorkDays: ctx.actualWorkDays,
      workedDays: ctx.workDays,
      unpaidLeaveDays: ctx.unpaidLeaveDays,
      leaveDays: ctx.leaveDays,
      attendanceRatio,
    },

    evaluation: {
      evaluationId: ctx.monthlyEvaluationId ?? null,
      status: src.evaluation.status ?? null,
      performanceRatio: ctx.performanceRatio,
      goalRatio: ctx.goalRatio,
      // Do not retain references to the resolved evaluation document. The
      // payroll row is the historical source of truth from this point onward.
      criteria: src.evaluation.criteria.map((criterion) => ({ ...criterion })),
    },

    policy: {
      policyId: ctx.policyConfigId ?? null,
      effectiveFrom: src.policy.effectiveFrom ? copyDate(src.policy.effectiveFrom) : null,
      weights: { ...(ctx.weights ?? DEFAULT_COMPONENT_WEIGHTS) },
      internPayAmount: dec(src.policy.internPayAmount),
      probationPayRate: src.policy.probationPayRate,
      socialInsuranceSalary: dec(src.policy.socialInsuranceSalary),
      unionFeeRate: src.policy.unionFeeRate,
      unionFeeEnabled: src.policy.unionFeeEnabled,
      personalDeduction: dec(ctx.personalDeduction),
      dependentDeduction: dec(ctx.dependentDeduction),
      taxEnabled: ctx.taxEnabled ?? false,
    },

    insurance: {
      exempt: src.insuranceExempt,
      base: dec(r.insuranceBase),
      unemploymentBase: dec(r.unemploymentInsuranceBase),
      fixedAmount: dec(ctx.fixedInsuranceAmount ?? 0),
      socialHealthCeiling: dec(ctx.socialHealthCeiling),
      unemploymentCeiling: dec(ctx.unemploymentCeiling),
      rates: ctx.insuranceRates
        ? {
            ...ctx.insuranceRates,
            employee: { ...ctx.insuranceRates.employee },
            employer: { ...ctx.insuranceRates.employer },
          }
        : null,
      employeeDeduction: dec(r.insurance),
      employerContribution: dec(
        r.employerSocialInsurance +
          r.employerHealthInsurance +
          r.employerUnemploymentInsurance +
          r.employerOccupationalInsurance,
      ),
    },

    totals: {
      baseSalary: dec(r.baseSalary),
      attendanceAmount: dec(r.attendanceComponent),
      performanceAmount: dec(r.performanceComponent),
      goalAmount: dec(r.goalComponent),
      proRatedBaseSalary: dec(r.proRatedBaseSalary),
      allowances: dec(r.totalAllowances),
      bonuses: dec(r.totalBonuses),
      grossSalary: dec(r.grossSalary),
      insuranceDeduction: dec(r.insurance),
      tax: dec(r.tax),
      unionFee: dec(r.unionFee),
      otherDeductions: dec(r.otherDeductions),
      totalDeductions: dec(r.totalDeductions),
      netSalary: dec(r.netSalary),
    },

    calculatedAt,
  };

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

    calculationSnapshot,

    status: 'draft',
    computedAt: calculatedAt,
  };
}
