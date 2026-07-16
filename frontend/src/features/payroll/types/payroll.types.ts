import type { DecimalLike } from "@/shared/utils/money";

export type PayrollPeriodStatus = "open" | "processing" | "closed" | "paid";
export type PayrollStatus = "draft" | "approved" | "paid";
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

export interface PayrollPeriod {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  payDate: string;
  standardWorkDays: number;
  status: PayrollPeriodStatus;
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
