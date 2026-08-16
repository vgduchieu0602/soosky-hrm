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
  computeEffectiveBaseSalary,
  computePayroll,
  type EffectiveBaseResult,
  type SalaryComponentWeights,
  type TaxBracket,
  type InsuranceRates,
} from '@shared/utils/salary.util';

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(Math.round(n)));

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
  standardWorkDays: number;
  actualWorkDays: number;
  /** Thử việc/thực tập = 0 theo quy định hiện hành. */
  performanceRatio: number;
  goalRatio: number;
  weights: SalaryComponentWeights;
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
      baseSalary: Math.round(segment.baseSalary * segment.payRate),
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

    // Additive: cho phép kiểm chứng "kỳ này gồm mấy đoạn, mỗi đoạn ra bao nhiêu".
    // Ảnh chụp đầy đủ (chính sách, tiêu chí đánh giá) thuộc giai đoạn sau.
    contractSegments: ctx.segments.map((segment, i) => ({
      contractId: segment.contractId,
      from: segment.from,
      to: segment.to,
      employmentStatus: segment.employmentStatus,
      baseSalary: dec(segment.baseSalary),
      payRate: segment.payRate,
      standardWorkDays: segment.standardWorkDays,
      actualWorkDays: segment.actualWorkDays,
      attendanceComponent: dec(segments.perSegment[i]!.attendanceComponent),
      performanceComponent: dec(segments.perSegment[i]!.performanceComponent),
      goalComponent: dec(segments.perSegment[i]!.goalComponent),
      segmentSalary: dec(segments.perSegment[i]!.proRatedBaseSalary),
    })),

    status: 'draft',
    computedAt: new Date(),
  };
}
