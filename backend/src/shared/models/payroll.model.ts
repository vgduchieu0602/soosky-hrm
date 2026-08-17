import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'payroll';
const COLLECTION_NAME = 'payrolls';

export const PAYROLL_STATUS = ['draft', 'approved', 'paid'] as const;
export type PayrollStatus = (typeof PAYROLL_STATUS)[number];

type Dec = mongoose.Types.Decimal128;

/**
 * Một đoạn lương trong kỳ, ứng với đúng một hợp đồng.
 *
 * Kỳ lương có thể trải trên nhiều hợp đồng (thử việc → chính thức, đổi mức lương
 * giữa tháng). Mảng này cho biết kỳ được chia thế nào và mỗi đoạn ra bao nhiêu —
 * đủ để đối chiếu con số cuối cùng.
 *
 * Đủ dữ liệu để DỰNG LẠI đoạn mà không tra hợp đồng/chính sách hiện tại:
 *   thành phần = baseSalary × payRate × trọng số/100 × tỷ lệ/100
 */
export interface IPayrollContractSegment {
  contractId: Types.ObjectId;
  from: Date;
  to: Date;
  employmentStatus: string;
  /** Lương ghi trên hợp đồng của đoạn. */
  baseSalary: Dec;
  /** Tỷ lệ hưởng: 1 chính thức/thực tập · `probationPayRate` khi thử việc. */
  payRate: number;
  standardWorkDays: number;
  actualWorkDays: number;
  /** Trọng số áp cho ĐOẠN này (thử việc/thực tập dồn 100% vào chấm công). */
  weights: ISnapshotWeights;
  /** Tỷ lệ hiệu suất/mục tiêu áp cho đoạn, 0–100 (0 với thử việc/thực tập). */
  performanceRatio: number;
  goalRatio: number;
  attendanceComponent: Dec;
  performanceComponent: Dec;
  goalComponent: Dec;
  /** Tổng ba thành phần của riêng đoạn này. */
  segmentSalary: Dec;
}

export interface ISnapshotWeights {
  attendance: number;
  performance: number;
  goal: number;
}

/** Điểm một tiêu chí đánh giá, chép lại tại thời điểm tính. */
export interface IPayrollSnapshotCriterion {
  criterionId: Types.ObjectId;
  /** Criterion metadata comes from the MonthlyEvaluation snapshot, not live config. */
  name?: string;
  group?: 'performance' | 'goal';
  weight?: number;
  score: number;
}

/**
 * ẢNH CHỤP TÍNH LƯƠNG — mọi đầu vào QUYẾT ĐỊNH con số của kỳ, chép lại đúng lúc
 * tính.
 *
 * Lý do tồn tại: chính sách lương, hợp đồng, đánh giá và cấu hình bảo hiểm đều
 * thay đổi theo thời gian. Không có ảnh chụp thì phiếu lương tháng 08 phải tra
 * cấu hình HÔM NAY để giải thích, và sẽ giải thích SAI ngay khi công ty đổi
 * trọng số hay mức đóng BHXH.
 *
 * Lưu ID để truy vết + GIÁ TRỊ ĐÃ DÙNG để làm sự thật lịch sử. KHÔNG chép nguyên
 * document nguồn — chỉ những trường thực sự tham gia phép tính.
 */
export interface IPayrollCalculationSnapshot {
  /** Phiên bản hình dạng ảnh chụp. Tăng khi đổi cấu trúc. */
  version: number;

  period: { name: string; startDate: Date; endDate: Date; payDate: Date };

  /** Khoảng người này thực sự thuộc bảng lương của kỳ (P0.1.1). */
  employment: {
    hireDate: Date;
    terminationDate?: Date | null;
    effectiveStart: Date;
    effectiveEnd: Date;
  };

  /** Các đoạn hợp đồng của kỳ — GIỮ ĐỦ, không chỉ hợp đồng cuối kỳ. */
  contracts: IPayrollContractSegment[];

  attendance: {
    standardWorkDays: number;
    actualWorkDays: number;
    workedDays: number;
    unpaidLeaveDays: number;
    leaveDays: number;
    attendanceRatio: number;
  };

  evaluation: {
    evaluationId?: Types.ObjectId | null;
    status?: string | null;
    performanceRatio: number;
    goalRatio: number;
    criteria: IPayrollSnapshotCriterion[];
  };

  policy: {
    policyId?: Types.ObjectId | null;
    effectiveFrom?: Date | null;
    weights: ISnapshotWeights;
    probationPayRate: number;
    socialInsuranceSalary: Dec;
    unionFeeRate: number;
    unionFeeEnabled: boolean;
    personalDeduction: Dec;
    dependentDeduction: Dec;
    taxEnabled: boolean;
  };

  insurance: {
    /** Thực tập/thử việc cả kỳ → không đóng bảo hiểm bắt buộc. */
    exempt: boolean;
    base: Dec;
    unemploymentBase: Dec;
    /** Mức BHXH cố định HR nhập trên hồ sơ thuế (0 = tính theo %). */
    fixedAmount: Dec;
    socialHealthCeiling: Dec;
    unemploymentCeiling: Dec;
    /** Bảng tỷ lệ % đã dùng khi không có mức cố định. */
    rates?: Record<string, unknown> | null;
    employeeDeduction: Dec;
    employerContribution: Dec;
  };

  totals: {
    baseSalary: Dec;
    attendanceAmount: Dec;
    performanceAmount: Dec;
    goalAmount: Dec;
    proRatedBaseSalary: Dec;
    allowances: Dec;
    bonuses: Dec;
    grossSalary: Dec;
    insuranceDeduction: Dec;
    tax: Dec;
    unionFee: Dec;
    otherDeductions: Dec;
    totalDeductions: Dec;
    netSalary: Dec;
  };

  calculatedAt: Date;
}

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
  /** Union fee (đoàn phí công đoàn), post-tax deduction. */
  unionFee: Dec;
  /** Other post-tax deductions (advance repayment, fines, …). */
  otherDeductions: Dec;

  // Net
  totalDeductions: Dec;
  netSalary: Dec;

  leaveDays: number;
  /**
   * Ảnh chụp đầu vào tại thời điểm tính. Bản ghi tính trước P0.2 KHÔNG có trường
   * này (optional) — API cũ vẫn chạy, chỉ mất khả năng tự giải thích.
   */
  calculationSnapshot?: IPayrollCalculationSnapshot;
  status: PayrollStatus;
  approvedBy?: Types.ObjectId | null;
  paidAt?: Date | null;
  computedAt?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export type PayrollDoc = HydratedDocument<IPayroll>;

const dec = { type: Schema.Types.Decimal128, default: () => mongoose.Types.Decimal128.fromString('0') };

const snapshotWeightsSchema = new Schema<ISnapshotWeights>(
  {
    attendance: { type: Number, required: true },
    performance: { type: Number, required: true },
    goal: { type: Number, required: true },
  },
  { _id: false },
);

const payrollContractSegmentSchema = new Schema<IPayrollContractSegment>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'employeeContracts', required: true },
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    employmentStatus: { type: String, required: true },
    baseSalary: dec,
    payRate: { type: Number, default: 1 },
    standardWorkDays: { type: Number, default: 0 },
    actualWorkDays: { type: Number, default: 0 },
    weights: { type: snapshotWeightsSchema, required: true },
    performanceRatio: { type: Number, default: 0 },
    goalRatio: { type: Number, default: 0 },
    attendanceComponent: dec,
    performanceComponent: dec,
    goalComponent: dec,
    segmentSalary: dec,
  },
  { _id: false },
);

const snapshotCriterionSchema = new Schema<IPayrollSnapshotCriterion>(
  {
    criterionId: { type: Schema.Types.ObjectId, ref: 'performanceCriteria', required: true },
    name: { type: String },
    group: { type: String, enum: ['performance', 'goal'] },
    weight: { type: Number, min: 0, max: 100 },
    score: { type: Number, required: true },
  },
  { _id: false },
);

const calculationSnapshotSchema = new Schema<IPayrollCalculationSnapshot>(
  {
    version: { type: Number, required: true, default: 1 },

    period: {
      _id: false,
      name: { type: String, default: '' },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      payDate: { type: Date, required: true },
    },

    employment: {
      _id: false,
      hireDate: { type: Date, required: true },
      terminationDate: { type: Date, default: null },
      effectiveStart: { type: Date, required: true },
      effectiveEnd: { type: Date, required: true },
    },

    contracts: { type: [payrollContractSegmentSchema], default: [] },

    attendance: {
      _id: false,
      standardWorkDays: { type: Number, default: 0 },
      actualWorkDays: { type: Number, default: 0 },
      workedDays: { type: Number, default: 0 },
      unpaidLeaveDays: { type: Number, default: 0 },
      leaveDays: { type: Number, default: 0 },
      attendanceRatio: { type: Number, default: 0 },
    },

    evaluation: {
      _id: false,
      evaluationId: { type: Schema.Types.ObjectId, ref: 'monthlyEvaluations', default: null },
      status: { type: String, default: null },
      performanceRatio: { type: Number, default: 0 },
      goalRatio: { type: Number, default: 0 },
      criteria: { type: [snapshotCriterionSchema], default: [] },
    },

    policy: {
      _id: false,
      policyId: { type: Schema.Types.ObjectId, ref: 'salaryPolicyConfigs', default: null },
      effectiveFrom: { type: Date, default: null },
      weights: { type: snapshotWeightsSchema, required: true },
      probationPayRate: { type: Number, default: 0 },
      socialInsuranceSalary: dec,
      unionFeeRate: { type: Number, default: 0 },
      unionFeeEnabled: { type: Boolean, default: false },
      personalDeduction: dec,
      dependentDeduction: dec,
      taxEnabled: { type: Boolean, default: false },
    },

    insurance: {
      _id: false,
      exempt: { type: Boolean, default: false },
      base: dec,
      unemploymentBase: dec,
      fixedAmount: dec,
      socialHealthCeiling: dec,
      unemploymentCeiling: dec,
      rates: { type: Schema.Types.Mixed, default: null },
      employeeDeduction: dec,
      employerContribution: dec,
    },

    totals: {
      _id: false,
      baseSalary: dec,
      attendanceAmount: dec,
      performanceAmount: dec,
      goalAmount: dec,
      proRatedBaseSalary: dec,
      allowances: dec,
      bonuses: dec,
      grossSalary: dec,
      insuranceDeduction: dec,
      tax: dec,
      unionFee: dec,
      otherDeductions: dec,
      totalDeductions: dec,
      netSalary: dec,
    },

    calculatedAt: { type: Date, required: true },
  },
  { _id: false },
);

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
    unionFee: dec,
    otherDeductions: dec,

    totalDeductions: dec,
    netSalary: dec,

    leaveDays: { type: Number, default: 0 },
    calculationSnapshot: { type: calculationSnapshotSchema, default: undefined },
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
