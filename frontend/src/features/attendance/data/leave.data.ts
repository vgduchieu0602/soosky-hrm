// Soosky HRM — Leave (Nghỉ phép) mock data
// Replace with real API responses (see share-docs/API-SPEC.md).

import type { ChipColor } from "@features/dashboard/data";
import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export type LeaveTypeKey =
  | "annual"
  | "sick"
  | "personal"
  | "unpaid"
  | "maternity"
  | "paternity";

export type LeaveStatusKey = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveTypeMeta {
  label: string;
  chip: ChipColor;
}

export const LEAVE_TYPE: Record<LeaveTypeKey, LeaveTypeMeta> = {
  annual: { label: "Phép năm", chip: "violet" },
  sick: { label: "Nghỉ ốm", chip: "rose" },
  personal: { label: "Việc riêng", chip: "amber" },
  unpaid: { label: "Không lương", chip: "blue" },
  maternity: { label: "Thai sản", chip: "cyan" },
  paternity: { label: "Vợ sinh", chip: "emerald" },
};

export interface LeaveStatusMeta {
  label: string;
  variant: BadgeVariant;
}

export const LEAVE_STATUS: Record<LeaveStatusKey, LeaveStatusMeta> = {
  pending: { label: "Chờ duyệt", variant: "amber" },
  approved: { label: "Đã duyệt", variant: "emerald" },
  rejected: { label: "Từ chối", variant: "rose" },
  cancelled: { label: "Đã huỷ", variant: "slate" },
};

export const DEPTS = [
  "Tất cả",
  "Engineering",
  "Sales",
  "Marketing",
  "Operations",
  "Finance",
] as const;

export interface LeaveRequest {
  id: string;
  name: string;
  initials: string;
  code: string;
  dept: string;
  type: LeaveTypeKey;
  status: LeaveStatusKey;
  start: string;
  end: string;
  days: number;
  half: "morning" | "afternoon" | null;
  submitted: string;
  approver: string;
  reason: string;
  rejection?: string;
}

export const REQUESTS: LeaveRequest[] = [
  {
    id: "LR-2026-0612",
    name: "Trần Minh Anh",
    initials: "MA",
    code: "EMP-0142",
    dept: "Engineering",
    type: "annual",
    status: "pending",
    start: "12/06/2026",
    end: "14/06/2026",
    days: 3,
    half: null,
    submitted: "03/06 · 09:12",
    approver: "Vương Đức Hiếu",
    reason: "Về quê thăm gia đình.",
  },
  {
    id: "LR-2026-0610",
    name: "Nguyễn Văn Bảo",
    initials: "VB",
    code: "EMP-0089",
    dept: "Sales",
    type: "annual",
    status: "pending",
    start: "10/06/2026",
    end: "14/06/2026",
    days: 5,
    half: null,
    submitted: "03/06 · 08:40",
    approver: "Vương Đức Hiếu",
    reason: "Du lịch cùng gia đình dịp hè.",
  },
  {
    id: "LR-2026-0603",
    name: "Phạm Thu Hà",
    initials: "TH",
    code: "EMP-0207",
    dept: "Marketing",
    type: "sick",
    status: "pending",
    start: "03/06/2026",
    end: "03/06/2026",
    days: 1,
    half: null,
    submitted: "03/06 · 07:55",
    approver: "Vương Đức Hiếu",
    reason: "Khám và điều trị bệnh, có giấy của bệnh viện.",
  },
  {
    id: "LR-2026-0605",
    name: "Lê Khánh Duy",
    initials: "KD",
    code: "EMP-0156",
    dept: "Operations",
    type: "personal",
    status: "pending",
    start: "05/06/2026",
    end: "05/06/2026",
    days: 0.5,
    half: "morning",
    submitted: "02/06 · 16:20",
    approver: "Vương Đức Hiếu",
    reason: "Giải quyết việc cá nhân buổi sáng.",
  },
  {
    id: "LR-2026-0602",
    name: "Đỗ Thanh Tùng",
    initials: "TT",
    code: "EMP-0073",
    dept: "Finance",
    type: "annual",
    status: "approved",
    start: "02/06/2026",
    end: "03/06/2026",
    days: 2,
    half: null,
    submitted: "28/05 · 14:08",
    approver: "Vương Đức Hiếu",
    reason: "Nghỉ phép năm theo kế hoạch.",
  },
  {
    id: "LR-2026-0526",
    name: "Nguyễn Lan Anh",
    initials: "LA",
    code: "EMP-0024",
    dept: "Sales",
    type: "annual",
    status: "approved",
    start: "26/05/2026",
    end: "27/05/2026",
    days: 2,
    half: null,
    submitted: "20/05 · 10:00",
    approver: "Vương Đức Hiếu",
    reason: "Việc gia đình.",
  },
  {
    id: "LR-2026-0601",
    name: "Mai Hoài Phương",
    initials: "HP",
    code: "EMP-0188",
    dept: "Operations",
    type: "maternity",
    status: "approved",
    start: "01/06/2026",
    end: "28/09/2026",
    days: 120,
    half: null,
    submitted: "15/05 · 09:30",
    approver: "Vương Đức Hiếu",
    reason: "Nghỉ thai sản theo chế độ BHXH.",
  },
  {
    id: "LR-2026-0522",
    name: "Trần Đức Bình",
    initials: "DB",
    code: "EMP-0091",
    dept: "Engineering",
    type: "personal",
    status: "rejected",
    start: "22/05/2026",
    end: "22/05/2026",
    days: 1,
    half: null,
    submitted: "18/05 · 11:20",
    approver: "Vương Đức Hiếu",
    reason: "Việc gia đình.",
    rejection: "Trùng lịch release sản phẩm, đề nghị dời sang tuần sau.",
  },
  {
    id: "LR-2026-0519",
    name: "Lê Quang Vũ",
    initials: "QV",
    code: "EMP-0202",
    dept: "Marketing",
    type: "annual",
    status: "cancelled",
    start: "19/05/2026",
    end: "19/05/2026",
    days: 1,
    half: null,
    submitted: "12/05 · 15:00",
    approver: "Vương Đức Hiếu",
    reason: "Đổi lịch cá nhân nên tự huỷ đơn.",
  },
];

export interface LeaveBalance {
  type: LeaveTypeKey;
  entitled: number; // 0 = không giới hạn (hiển thị ∞)
  used: number;
  remaining: number;
}

export const BALANCES: LeaveBalance[] = [
  { type: "annual", entitled: 12, used: 5, remaining: 7 },
  { type: "sick", entitled: 30, used: 2, remaining: 28 },
  { type: "personal", entitled: 3, used: 1, remaining: 2 },
  { type: "unpaid", entitled: 0, used: 0, remaining: 0 },
];

export interface Holiday {
  name: string;
  date: string;
  recurring: boolean;
  days: number;
}

export const HOLIDAYS: Holiday[] = [
  { name: "Quốc khánh", date: "02/09/2026", recurring: true, days: 2 },
  { name: "Tết Dương lịch", date: "01/01/2027", recurring: true, days: 1 },
  { name: "Tết Nguyên đán", date: "16/02/2027", recurring: true, days: 5 },
  { name: "Giỗ Tổ Hùng Vương", date: "26/04/2027", recurring: true, days: 1 },
];
