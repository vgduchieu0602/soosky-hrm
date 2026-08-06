/** Hồ sơ công ty — khớp đúng `CompanyProfileDTO` của backend. */
export interface CompanyConfig {
  companyName: string;
  address?: string | null;
  taxCode?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  logoUrl?: string | null;
  timezone: string;
  currency?: string;
  standardWorkHoursPerDay?: number;
  standardWorkDaysPerMonth?: number;
}

export interface ComponentWeights {
  attendance: number;
  performance: number;
  goal: number;
}

/**
 * Chính sách lương có HIỆU LỰC TỪ một ngày — khớp `SalaryPolicyDTO` của backend.
 * Bậc thuế và tỷ lệ bảo hiểm nằm trong entity phía backend, không sửa từ UI.
 */
export interface SalaryPolicy {
  _id: string;
  effectiveFrom: string;
  baseSalaryReference: number;
  regionalMinWage: number;
  insuranceCeilingMultiplier: number;
  socialInsuranceSalary: number;
  personalDeduction: number;
  dependentDeduction: number;
  unionFeeRate: number;
  unionFeeEnabled: boolean;
  taxEnabled: boolean;
  nonResidentTaxRate: number;
  probationPayRate: number;
  prorateByAttendance: boolean;
  createdAt: string;
}

export interface Shift {
  _id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /** Thứ theo ISO (1 = thứ Hai … 7 = Chủ nhật). */
  workingDays: number[];
  status: "active" | "archived";
}

export interface Holiday {
  _id: string;
  name: string;
  date: string;
  isRecurring: boolean;
}

export interface AttendanceSymbol {
  _id: string;
  code: string;
  name: string;
  description?: string;
}
