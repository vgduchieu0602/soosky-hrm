import type { DecimalLike } from "@/shared/utils/money";

export type PayrollPeriodStatus = "open" | "processing" | "closed" | "paid";

/**
 * Bước trong quy trình lương 7 bước — chi tiết hơn `status`.
 *
 * `status` không phân biệt được "đã tính thử" với "HR đã soát", mà backend chặn
 * duyệt đúng ở chỗ đó, nên UI phải đọc `stage` để biết bấm gì tiếp theo.
 */
export type PayrollPeriodStage =
  | "open" | "reconciling" | "trial" | "hr_reviewed" | "approved" | "paid" | "closed";
export type PayrollStatus = "draft" | "approved" | "paid";

/** Phiên bản công thức tính lương. `v1` chỉ còn dùng làm mốc đối soát. */
export type PayrollEngineVersion = "v1" | "v2";

/** Một ô số khác nhau giữa hai phiên bản công thức. */
export interface PayrollVarianceField {
  field: string;
  baseline: number;
  target: number;
}

/**
 * Chênh lệch giữa hai phiên bản công thức cho một nhân viên trong một kỳ.
 *
 * `signedAt == null` = chưa ai giải thích và ký; còn dòng như vậy thì backend
 * chặn bước "HR đã soát" của kỳ.
 */
export interface PayrollVariance {
  payrollPeriodId: string;
  employeeId: string;
  baselineEngine: PayrollEngineVersion;
  targetEngine: PayrollEngineVersion;
  baselineNet: number;
  targetNet: number;
  /** Dương = phiên bản mới trả cao hơn phiên bản cũ. */
  diff: number;
  fields: PayrollVarianceField[];
  detectedAt: string;
  detectedBy: string;
  signedBy: string | null;
  signedAt: string | null;
  explanation: string | null;
}

/** Kết quả sinh file chuyển lương theo mẫu ngân hàng đang bật. */
export interface BankTransferFileResult {
  fileName: string;
  /** Nội dung file (đã gồm BOM nếu mẫu yêu cầu). */
  content: string;
  bankCode: string;
  bankName: string;
  rowCount: number;
  totalAmount: number;
  /** Nhân viên bị loại khỏi lệnh chi kèm lý do — phải hiện cho người dùng. */
  skipped: { employeeId: string; reason: string }[];
}

/** Điều chỉnh hồi tố: truy lĩnh (`claim`) / truy thu (`clawback`) cho kỳ trước. */
export interface RetroAdjustment {
  id: string;
  employeeId: string;
  kind: "claim" | "clawback";
  amount: number;
  taxable: boolean;
  originPeriodId: string;
  payoutPeriodId: string;
  reason: string;
  status: "active" | "cancelled";
  createdBy: string;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export interface ReconciliationRunResult {
  periodId: string;
  baselineEngine: PayrollEngineVersion;
  targetEngine: PayrollEngineVersion;
  comparedCount: number;
  varianceCount: number;
  unsignedCount: number;
  errors: { employeeId: string; message: string }[];
}
export type SalaryZone = "zone1" | "zone2" | "zone3" | "zone4";

export interface GrossUpInput {
  net: number;
  dependentsCount?: number;
  isResident?: boolean;
  salaryZone?: SalaryZone;
}

export interface GrossUpResult {
  gross: number;
  net: number;
  insurance: number;
  tax: number;
  employerInsurance: number;
  employerCost: number;
}

/** Một dòng lương theo đoạn hợp đồng trong kỳ. */
export interface PayslipSegment {
  contractId: string;
  contractNumber: string;
  employmentStatus: string;
  from: string;
  to: string;
  workDays: number;
  baseSalary: number;
  effectiveBase: number;
  attendanceRatio: number;
  proRatedBaseSalary: number;
}

export interface PayrollPeriod {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  payDate: string;
  standardWorkDays: number;
  status: PayrollPeriodStatus;
  stage?: PayrollPeriodStage;
  hrReviewedBy?: string | null;
  hrReviewedAt?: string | null;
  closedAt?: string | null;
  attendanceLockedAt?: string | null;
  evaluationLockedAt?: string | null;
  created_at?: string;
}

export interface AttendanceReadiness {
  attendanceLocked: boolean;
  totalActiveEmployees: number;
  employeesNoRecords: number;
  incompleteRecords: number;
  employeesWithIncomplete: number;
}

export interface EvaluationReadiness {
  evaluationLocked: boolean;
  totalActiveEmployees: number;
  finalizedEvaluations: number;
  employeesNoEvaluation: number;
}

export interface CreatePeriodInput {
  name: string;
  startDate: string;
  endDate: string;
  payDate: string;
  standardWorkDays?: number;
}

/** Computed payroll row — money fields are Decimal128-ish from the API. */
export interface PayrollRecord {
  _id: string;
  payrollPeriodId: string;
  employeeId: string;
  status: PayrollStatus;

  standardWorkDays: number;
  actualWorkDays: number;
  unpaidLeaveDays: number;
  workDays: number;
  leaveDays: number;

  attendanceRatio: number;
  performanceRatio: number;
  goalRatio: number;
  attendanceComponent: DecimalLike;
  performanceComponent: DecimalLike;
  goalComponent: DecimalLike;

  baseSalary: DecimalLike;
  proRatedBaseSalary: DecimalLike;
  totalTaxableAllowances: DecimalLike;
  totalNonTaxableAllowances: DecimalLike;
  totalAllowances: DecimalLike;
  overtimePay: DecimalLike;
  totalBonuses: DecimalLike;
  /** Truy lĩnh kỳ trước, đã cộng vào Gross của kỳ này. */
  totalRetroClaims?: DecimalLike;
  /** Truy thu kỳ trước, khấu trừ sau thuế. */
  totalRetroClawbacks?: DecimalLike;
  /** Dòng lương theo đoạn hợp đồng (chỉ có khi đổi hợp đồng giữa kỳ). */
  segments?: PayslipSegment[];
  grossSalary: DecimalLike;

  insuranceBase: DecimalLike;
  socialInsurance: DecimalLike;
  healthInsurance: DecimalLike;
  unemploymentInsurance: DecimalLike;
  insurance: DecimalLike;

  taxableIncome: DecimalLike;
  personalDeduction: DecimalLike;
  dependentDeduction: DecimalLike;
  dependentsCount: number;
  taxableIncomeAfterDeduction: DecimalLike;
  tax: DecimalLike;
  unionFee: DecimalLike;
  otherDeductions: DecimalLike;

  totalDeductions: DecimalLike;
  netSalary: DecimalLike;

  computedAt?: string | null;
  paidAt?: string | null;
  /** Attached by GET /payroll/payrolls/me for the self-service portal. */
  periodName?: string;
}

export interface PeriodTotalRow {
  _id: PayrollStatus;
  count: number;
  gross: number;
  net: number;
}

export interface PreflightItem {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  blockers: string[];
  warnings: string[];
}
export interface PayrollPreflight {
  total: number;
  ready: number;
  blockedCount: number;
  policyWarnings: string[];
  items: PreflightItem[];
}

export interface RunResult {
  periodId: string;
  computed: number;
  errors: { employeeId: string; reason: string }[];
}

export interface ApprovalResult {
  periodId: string;
  affected: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ---- Compensation ----
export type AmountType = "fixed" | "percentage";

export interface Allowance {
  _id: string;
  employeeId: string;
  name: string;
  category: string;
  type: AmountType;
  amount: DecimalLike;
  isTaxable: boolean;
  isInsuranceBase: boolean;
  effectiveDate: string;
  endDate?: string | null;
}

export interface Bonus {
  _id: string;
  employeeId: string;
  payrollPeriodId: string;
  name: string;
  amount: DecimalLike;
  isTaxable: boolean;
  reason?: string | null;
}

export interface Deduction {
  _id: string;
  employeeId: string;
  payrollPeriodId?: string | null;
  name: string;
  type: AmountType;
  amount: DecimalLike;
  effectiveDate: string;
  endDate?: string | null;
}

export interface TaxProfile {
  _id: string;
  employeeId: string;
  taxCode?: string | null;
  isResident: boolean;
  dependentsCount: number;
  insuranceAmount?: number;
  effectiveDate: string;
  endDate?: string | null;
}
