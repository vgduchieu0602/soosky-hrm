// Soosky HRM — Payroll mock data + computation helpers.
// Replace with real API responses (see share-docs/API-SPEC.md) when the
// payroll backend endpoints are available.

type BadgeVariant = "slate" | "amber" | "emerald" | "blue" | "violet" | "rose";

export interface PeriodInfo {
  name: string;
  label: string;
  standardWorkDays: number;
  payDate: string;
}

export const PERIOD: PeriodInfo = {
  name: "Tháng 5, 2026",
  label: "Tháng 5, 2026",
  standardWorkDays: 22,
  payDate: "31/05/2026",
};

/** Salary is composed from 3 weighted groups (sum = 100%). */
export const SALARY_WEIGHTS = { days: 0.2, perf: 0.6, goal: 0.2 } as const;

export interface PayStatusMeta {
  label: string;
  variant: BadgeVariant;
}

export const PAY_STATUS: Record<string, PayStatusMeta> = {
  draft: { label: "Nháp", variant: "slate" },
  approved: { label: "Đã duyệt", variant: "blue" },
  paid: { label: "Đã chi", variant: "emerald" },
};

export interface PerfCriterion {
  key: string;
  short: string;
  label: string;
}

export const PERF_CRITERIA: PerfCriterion[] = [
  { key: "quality", short: "Chất lượng", label: "Chất lượng công việc" },
  { key: "productivity", short: "Năng suất", label: "Năng suất & khối lượng" },
  { key: "teamwork", short: "Phối hợp", label: "Phối hợp & tinh thần đồng đội" },
  { key: "discipline", short: "Kỷ luật", label: "Kỷ luật & tuân thủ" },
];

export const DEPTS = [
  "Tất cả",
  "Engineering",
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
];

export type PayStatus = "draft" | "approved" | "paid";

export interface PayrollRow {
  code: string;
  name: string;
  initials: string;
  dept: string;
  status: PayStatus;
  base: number;
  workDays: number;
  perf: number[];
  goal: number;
  insurance: number;
  tax: number;
  deductions: number;
  allowances: number;
  ot: number;
  bonus: number;
}

export const PAYROLLS: PayrollRow[] = [
  { code: "EMP-0011", name: "Phan Quỳnh Trang", initials: "QT", dept: "Sales", status: "approved", base: 32000000, workDays: 22, perf: [95, 92, 90, 98], goal: 96, insurance: 3360000, tax: 2100000, deductions: 0, allowances: 2000000, ot: 0, bonus: 3000000 },
  { code: "EMP-0034", name: "Bùi Trọng Hải", initials: "TH", dept: "Engineering", status: "approved", base: 38000000, workDays: 21, perf: [94, 90, 88, 92], goal: 90, insurance: 3990000, tax: 2600000, deductions: 0, allowances: 1500000, ot: 1800000, bonus: 0 },
  { code: "EMP-0067", name: "Vũ Ngọc Linh", initials: "NL", dept: "Marketing", status: "paid", base: 26000000, workDays: 22, perf: [90, 88, 92, 86], goal: 88, insurance: 2730000, tax: 1500000, deductions: 0, allowances: 1500000, ot: 0, bonus: 1200000 },
  { code: "EMP-0102", name: "Hoàng Văn Sơn", initials: "VS", dept: "Operations", status: "draft", base: 22000000, workDays: 20, perf: [85, 82, 88, 84], goal: 84, insurance: 2310000, tax: 900000, deductions: 200000, allowances: 1000000, ot: 600000, bonus: 0 },
  { code: "EMP-0145", name: "Đào Minh Châu", initials: "MC", dept: "Marketing", status: "draft", base: 28000000, workDays: 22, perf: [88, 90, 86, 89], goal: 90, insurance: 2940000, tax: 1700000, deductions: 0, allowances: 1500000, ot: 0, bonus: 0 },
  { code: "EMP-0089", name: "Nguyễn Văn Bảo", initials: "VB", dept: "Engineering", status: "approved", base: 30000000, workDays: 19, perf: [80, 84, 82, 86], goal: 82, insurance: 3150000, tax: 1600000, deductions: 0, allowances: 1500000, ot: 1200000, bonus: 0 },
  { code: "EMP-0142", name: "Trần Minh Anh", initials: "MA", dept: "Sales", status: "paid", base: 24000000, workDays: 22, perf: [92, 88, 90, 90], goal: 94, insurance: 2520000, tax: 1300000, deductions: 0, allowances: 2000000, ot: 0, bonus: 1500000 },
  { code: "EMP-0207", name: "Phạm Thu Hà", initials: "TH", dept: "Finance", status: "draft", base: 20000000, workDays: 21, perf: [86, 84, 88, 85], goal: 85, insurance: 2100000, tax: 700000, deductions: 0, allowances: 1000000, ot: 0, bonus: 0 },
];

export interface PayComputation {
  rDays: number;
  rPerf: number;
  rGoal: number;
  cDays: number;
  cPerf: number;
  cGoal: number;
  earned: number;
  gross: number;
  net: number;
}

export function compute(p: PayrollRow): PayComputation {
  const rDays = p.workDays / PERIOD.standardWorkDays;
  const perfAvg = p.perf.reduce((s, v) => s + v, 0) / p.perf.length; // 0–100
  const rPerf = perfAvg / 100;
  const rGoal = p.goal / 100;
  const cDays = SALARY_WEIGHTS.days * p.base * rDays;
  const cPerf = SALARY_WEIGHTS.perf * p.base * rPerf;
  const cGoal = SALARY_WEIGHTS.goal * p.base * rGoal;
  const earned = cDays + cPerf + cGoal;
  const gross = earned + p.allowances + p.ot + p.bonus;
  const net = gross - p.insurance - p.tax - p.deductions;
  return { rDays, rPerf, rGoal, cDays, cPerf, cGoal, earned, gross, net };
}

/** Format a number with Vietnamese thousands separators. */
export const fmt = (n: number): string => Math.round(n).toLocaleString("vi-VN");

/** Round a 0–100 ratio to an integer percentage. */
export const pctn = (n: number): number => Math.round(n);
