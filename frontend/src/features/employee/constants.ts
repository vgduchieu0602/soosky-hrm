// Employee feature — label maps, status grouping and display helpers.
// Vietnamese labels for the enums defined in employee.types.ts.

import type {
  AssetCondition,
  ContractType,
  DepartmentRef,
  DocumentType,
  EmployeeRecord,
  EmployeeStatus,
  EmployeeType,
  EmployeeView,
  Gender,
  HistoryEvent,
  ManagerRef,
  MaritalStatus,
  PositionRef,
  Relationship,
} from "@features/employee/types/employee.types";

type ChipVariant = "blue" | "emerald" | "violet" | "amber" | "indigo" | "cyan" | "slate" | "rose";

export const EMP_STATUS: Record<
  EmployeeStatus,
  { label: string; variant: ChipVariant; group: "active" | "inactive" }
> = {
  onboarding: { label: "Onboarding", variant: "blue", group: "active" },
  active: { label: "Đang làm việc", variant: "emerald", group: "active" },
  on_leave: { label: "Đang nghỉ", variant: "amber", group: "active" },
  terminated: { label: "Đã nghỉ việc", variant: "slate", group: "inactive" },
};

export const STATUS_ACTIVE: EmployeeStatus[] = ["onboarding", "active", "on_leave"];
export const STATUS_INACTIVE: EmployeeStatus[] = ["terminated"];

export const EMP_TYPE: Record<EmployeeType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Hợp đồng",
  intern: "Thực tập",
};

export const SALARY_ZONE_LABEL: Record<string, string> = {
  zone1: "Vùng 1",
  zone2: "Vùng 2",
  zone3: "Vùng 3",
  zone4: "Vùng 4",
};

export const GENDER: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
  undisclosed: "Không tiết lộ",
};

export const MARITAL: Record<MaritalStatus, string> = {
  single: "Độc thân",
  married: "Đã kết hôn",
  divorced: "Ly hôn",
  widowed: "Goá",
};

export const DOC_TYPE: Record<DocumentType, string> = {
  id_card: "CCCD/CMND",
  passport: "Hộ chiếu",
  degree: "Bằng cấp",
  certificate: "Chứng chỉ",
  visa: "Visa",
  other: "Khác",
};

export const CONTRACT_TYPE: Record<ContractType, string> = {
  probation: "Thử việc",
  fixed_term: "Có thời hạn",
  indefinite: "Không thời hạn",
  internship: "Thực tập",
};

export const REL: Record<Relationship, string> = {
  spouse: "Vợ/Chồng",
  parent: "Cha/Mẹ",
  sibling: "Anh/Chị/Em",
  other: "Khác",
};

export const COND: Record<AssetCondition, string> = {
  new: "Mới",
  good: "Tốt",
  fair: "Khá",
  damaged: "Hư hỏng",
};

export const HIST_EVENT: Record<HistoryEvent, string> = {
  hired: "Tuyển dụng",
  promotion: "Thăng chức",
  transfer: "Điều chuyển",
  salary_change: "Thay đổi lương",
  contract_renew: "Gia hạn HĐ",
  info_update: "Cập nhật thông tin",
  terminated: "Nghỉ việc",
};

export const ROLE: Record<string, string> = {
  admin: "Quản trị viên",
  hr_manager: "Quản lý nhân sự",
  manager: "Quản lý",
  employee: "Nhân viên",
};

// Status group filter labels used by the table filter pill.
export const STATUS_GROUP_LABEL = {
  active: "Đang hoạt động",
  inactive: "Ngừng hoạt động",
} as const;

// ---------- display helpers ----------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** Vietnamese name order: "{lastName} {middleName} {firstName}". */
export function fullNameOf(firstName?: string, lastName?: string, middleName?: string): string {
  return [lastName, middleName, firstName].filter(Boolean).join(" ").trim();
}

export function initialsOf(firstName?: string, lastName?: string): string {
  const a = (lastName ?? "").trim().charAt(0);
  const b = (firstName ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "NV";
}

/** Format an ISO date to DD/MM/YYYY; returns "" for empty/invalid input. */
export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Coerce a money value to a number. Tolerates plain numbers, numeric strings,
 * and Mongo's `{ $numberDecimal: "..." }` BSON wrapper (defensive — the backend
 * now serializes Decimal128 to a string, but older payloads may still leak it).
 */
export function parseDecimal(value?: number | string | { $numberDecimal?: string } | null): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "object") return Number(value.$numberDecimal ?? NaN);
  return typeof value === "string" ? Number(value) : value;
}

/** Format money (number, Decimal128 string, or `{ $numberDecimal }`) with thousands separators. */
export function formatMoney(value?: number | string | { $numberDecimal?: string } | null): string {
  if (value === null || value === undefined || value === "") return "0";
  const n = parseDecimal(value);
  if (Number.isNaN(n)) return "0";
  return n.toLocaleString("vi-VN");
}

function deptName(ref: DepartmentRef | string | null | undefined): string {
  if (!ref || typeof ref === "string") return "";
  return ref.name ?? "";
}

function positionTitle(ref: PositionRef | string | null | undefined): string {
  if (!ref || typeof ref === "string") return "";
  return ref.title ?? "";
}

function managerName(ref: ManagerRef | string | null | undefined): string {
  if (!ref || typeof ref === "string") return "";
  const p = ref.profile;
  const name = p ? fullNameOf(p.firstName, p.lastName, p.middleName) : "";
  return name || ref.employeeCode || "";
}

function refId(ref: { _id: string } | string | null | undefined): string {
  if (!ref) return "";
  return typeof ref === "string" ? ref : ref._id;
}

/**
 * Flatten a raw API employee record (list row or detail) into a display-ready
 * view model. Tolerates missing profile / unpopulated refs so it degrades
 * gracefully against the current backend (see edit.md for the enriched shape).
 */
export function toEmployeeView(rec: EmployeeRecord): EmployeeView {
  const profile = isObject(rec.profile) ? rec.profile : undefined;
  const firstName = profile?.firstName ?? "";
  const middleName = profile?.middleName ?? "";
  const lastName = profile?.lastName ?? "";
  const full = fullNameOf(firstName, lastName, middleName) || rec.employeeCode;
  const personalEmail = profile?.email ?? "";
  const workEmail = profile?.workEmail ?? "";

  return {
    id: rec._id,
    code: rec.employeeCode,
    fingerprintId: rec.fingerprintId ?? "",
    firstName,
    middleName,
    lastName,
    fullName: full,
    initials: initialsOf(firstName, lastName),
    departmentId: refId(rec.departmentId),
    departmentName: deptName(rec.departmentId),
    positionId: refId(rec.positionId),
    positionName: positionTitle(rec.positionId),
    managerId: rec.managerId ? refId(rec.managerId) || null : null,
    managerName: managerName(rec.managerId),
    employeeType: rec.employeeType,
    status: rec.status,
    hireDate: rec.hireDate,
    salaryZone: rec.salaryZone ?? "",
    userId: rec.userId ?? null,
    email: workEmail || personalEmail,
    personalEmail,
    phone: profile?.phone ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    gender: profile?.gender ?? "",
    maritalStatus: profile?.maritalStatus ?? "",
    nationality: profile?.nationality ?? "",
    address: profile?.address ?? "",
    avatarUrl: profile?.avatarUrl ?? "",
  };
}
