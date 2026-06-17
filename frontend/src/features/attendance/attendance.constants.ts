import type { ChipColor } from "@features/dashboard/data";
import type {
  AttendanceStatus,
  LeaveStatusKey,
  LeaveTypeKey,
} from "@features/attendance/types/attendance.types";

export const STATUS_META: Record<AttendanceStatus, { label: string; color: ChipColor }> = {
  present: { label: "Đủ công", color: "emerald" },
  late: { label: "Đi muộn", color: "amber" },
  early_leave: { label: "Về sớm", color: "amber" },
  incomplete: { label: "Thiếu chấm", color: "indigo" },
  absent: { label: "Vắng", color: "rose" },
  leave_paid: { label: "Nghỉ phép", color: "violet" },
  leave_unpaid: { label: "Không lương", color: "rose" },
  holiday: { label: "Nghỉ lễ", color: "cyan" },
};

export const LEAVE_TYPE_META: Record<LeaveTypeKey, { label: string; color: ChipColor }> = {
  annual: { label: "Phép năm", color: "violet" },
  sick: { label: "Nghỉ ốm", color: "rose" },
  personal: { label: "Việc riêng", color: "amber" },
  unpaid: { label: "Không lương", color: "blue" },
  maternity: { label: "Thai sản", color: "cyan" },
  paternity: { label: "Vợ sinh", color: "emerald" },
};

export const LEAVE_STATUS_META: Record<LeaveStatusKey, { label: string; variant: string }> = {
  pending: { label: "Chờ duyệt", variant: "amber" },
  approved: { label: "Đã duyệt", variant: "emerald" },
  rejected: { label: "Từ chối", variant: "rose" },
  cancelled: { label: "Đã huỷ", variant: "indigo" },
};

/** Days (1..n) and ISO date-keys (YYYY-MM-DD) for a "YYYY-MM" month. */
export function monthDays(month: string): { day: number; key: string; weekend: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate(); // last day of month
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    const dt = new Date(y, m - 1, day);
    const wd = dt.getDay(); // 0 Sun .. 6 Sat (local — for label only)
    return {
      day,
      key: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      weekend: wd === 0 || wd === 6,
    };
  });
}

/** ISO date-key (YYYY-MM-DD) of a stored record date (UTC date-key). */
export function recordDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Build an ISO instant for a VN wall-clock time on a given date-key. */
export function vnInstant(dateKey: string, hhmm: string): string {
  return `${dateKey}T${hhmm}:00+07:00`;
}

/** Extract HH:mm (VN) from a stored instant. */
export function hhmmVN(iso?: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export const MONTH_OPTIONS = (() => {
  // Last 6 months including current, in VN.
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}` });
  }
  return out;
})();
