// Soosky HRM — Attendance (Chấm công) mock data
// Replace with real API responses (see share-docs/API-SPEC.md).
// Reference month: June 2026 (01/06/2026 is a Monday).

import type { ChipColor } from "@features/dashboard/data";

export type MarkKey =
  | "full"
  | "late"
  | "annual"
  | "remote"
  | "unpaid"
  | "holiday"
  | "makeup"
  | "half_work"
  | "half_w_p"
  | "half_p_unpaid";

export interface MarkMeta {
  code: string;
  label: string;
  color: ChipColor;
}

export const MARKS: Record<MarkKey, MarkMeta> = {
  full: { code: "X", label: "Đủ công", color: "emerald" },
  late: { code: "Tr", label: "Đi muộn", color: "amber" },
  annual: { code: "P", label: "Nghỉ phép", color: "violet" },
  remote: { code: "R", label: "Làm từ xa", color: "blue" },
  unpaid: { code: "K", label: "Không lương", color: "rose" },
  holiday: { code: "L", label: "Nghỉ lễ", color: "cyan" },
  makeup: { code: "B", label: "Làm bù", color: "indigo" },
  half_work: { code: "X/2", label: "Nửa ngày công", color: "emerald" },
  half_w_p: { code: "X/P", label: "Nửa công + phép", color: "amber" },
  half_p_unpaid: { code: "P/K", label: "Nửa phép + KL", color: "violet" },
};

export const MARK_ORDER: MarkKey[] = [
  "full",
  "late",
  "remote",
  "makeup",
  "half_work",
  "annual",
  "half_w_p",
  "holiday",
  "unpaid",
  "half_p_unpaid",
];

export const MONTH_LABEL = "Tháng 6, 2026";

// Day numbers 1..30 for June 2026.
export const MONTH_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

// Day-of-week label by index: 0 = Sunday … 6 = Saturday.
export const DOW_LABEL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

// 01/06/2026 is Monday → dow(1) = 1. dow(7) = 0 (Sunday).
export const dow = (d: number) => d % 7;
export const isWeekend = (d: number) => dow(d) === 0 || dow(d) === 6;
export const dd = (d: number) => String(d).padStart(2, "0");

export const WORKING_DAYS = MONTH_DAYS.filter((d) => !isWeekend(d)).length; // 22

export const DEPTS = [
  "Tất cả",
  "Engineering",
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
] as const;

export interface AttendanceEmployee {
  name: string;
  code: string;
  initials: string;
  dept: string;
  annualLeft: number; // số phép năm còn lại đầu kỳ
  note?: string;
  days: Record<number, MarkKey>;
}

// Pre-fill every working day as "full", then apply per-day overrides.
const WORKDAYS = MONTH_DAYS.filter((d) => !isWeekend(d));
const fill = (overrides: Record<number, MarkKey>): Record<number, MarkKey> => {
  const base: Record<number, MarkKey> = {};
  for (const d of WORKDAYS) base[d] = "full";
  return { ...base, ...overrides };
};

export const EMPLOYEES: AttendanceEmployee[] = [
  {
    name: "Trần Minh Anh",
    code: "EMP-0142",
    initials: "MA",
    dept: "Engineering",
    annualLeft: 9,
    note: "WFH thứ 5, 6",
    days: fill({ 3: "late", 17: "remote", 18: "remote" }),
  },
  {
    name: "Nguyễn Văn Bảo",
    code: "EMP-0089",
    initials: "VB",
    dept: "Sales",
    annualLeft: 5,
    days: fill({ 10: "annual", 11: "annual", 12: "annual" }),
  },
  {
    name: "Phạm Thu Hà",
    code: "EMP-0207",
    initials: "TH",
    dept: "Marketing",
    annualLeft: 7,
    note: "Đi muộn 2 lần",
    days: fill({ 2: "late", 9: "late", 24: "half_w_p" }),
  },
  {
    name: "Lê Khánh Duy",
    code: "EMP-0156",
    initials: "KD",
    dept: "Operations",
    annualLeft: 1,
    note: "Vượt phép năm",
    days: fill({ 4: "annual", 5: "annual" }),
  },
  {
    name: "Đỗ Thanh Tùng",
    code: "EMP-0073",
    initials: "TT",
    dept: "Finance",
    annualLeft: 10,
    days: fill({ 15: "unpaid", 16: "unpaid" }),
  },
  {
    name: "Vũ Ngọc Linh",
    code: "EMP-0067",
    initials: "NL",
    dept: "Engineering",
    annualLeft: 8,
    days: fill({ 19: "remote", 22: "remote", 23: "makeup" }),
  },
  {
    name: "Hoàng Văn Sơn",
    code: "EMP-0102",
    initials: "VS",
    dept: "Sales",
    annualLeft: 6,
    days: fill({ 1: "late", 8: "half_p_unpaid" }),
  },
  {
    name: "Đào Minh Châu",
    code: "EMP-0145",
    initials: "MC",
    dept: "Marketing",
    annualLeft: 11,
    days: fill({ 25: "annual", 26: "annual", 29: "holiday", 30: "holiday" }),
  },
];

export interface AttendanceSummary {
  w: number; // công thực tế
  p: number; // nghỉ phép
  l: number; // nghỉ lễ
  c: number; // nghỉ chế độ (không lương)
  total: number; // tổng công
  remaining: number; // phép dư
}

export function summarize(e: AttendanceEmployee): AttendanceSummary {
  let w = 0;
  let p = 0;
  let l = 0;
  let c = 0;
  for (const d of MONTH_DAYS) {
    const m = e.days[d];
    if (!m) continue;
    switch (m) {
      case "full":
      case "late":
      case "remote":
      case "makeup":
        w += 1;
        break;
      case "annual":
        p += 1;
        break;
      case "holiday":
        l += 1;
        break;
      case "unpaid":
        c += 1;
        break;
      case "half_work":
        w += 0.5;
        break;
      case "half_w_p":
        w += 0.5;
        p += 0.5;
        break;
      case "half_p_unpaid":
        p += 0.5;
        c += 0.5;
        break;
    }
  }
  const total = w + p + l;
  const remaining = e.annualLeft - p;
  return { w, p, l, c, total, remaining };
}
