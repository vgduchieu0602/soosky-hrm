export interface CompanyConfig {
  companyName: string;
  logoUrl?: string;
  timezone: string;
  standardWorkDays: number;
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  contactEmail?: string;
  address?: string;
}

export interface ComponentWeights {
  attendance: number;
  performance: number;
  goal: number;
}

export interface SalaryPolicy {
  _id: string;
  country: string;
  year: number;
  effectiveFrom: string;
  baseSalary: string | number;
  insuranceCeilingMultiplier: number;
  personalDeduction: string | number;
  dependentDeduction: string | number;
  nonResidentTaxRate: number;
  socialInsuranceSalary?: string | number | null;
  unionFeeRate?: number;
  unionFeeEnabled?: boolean;
  salaryComponentWeights: ComponentWeights;
}

export interface PerformanceCriterion {
  _id: string;
  key: string;
  label: string;
  description?: string;
  type: "performance" | "goal";
  order: number;
  status: "active" | "archived";
}

export interface Shift {
  _id: string;
  name: string;
  type: "morning" | "afternoon" | "full_day";
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workingDays: number[];
  status: "active" | "archived";
}

export interface Holiday {
  _id: string;
  name: string;
  date: string;
  isRecurring: boolean;
  country: string;
  description?: string;
}

export interface AttendanceSymbol {
  _id: string;
  code: string;
  label: string;
  paidStatus: "paid" | "unpaid" | "neutral";
  affectsPayroll: boolean;
  leaveType?: string;
  color?: string;
}
