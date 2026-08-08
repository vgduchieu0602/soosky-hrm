/**
 * Quy tắc thuần của vòng đời nhân viên — không Express, không Mongoose.
 *
 * Nguyên tắc: trạng thái hiện tại nằm trên `employees`, còn MỌI thay đổi quan
 * trọng được ghi thành một bản ghi bất biến trong `employeeHistories` kèm
 * `effectiveDate` + lý do + người thực hiện. Lịch sử không bao giờ bị ghi đè, nên
 * chỉ cần "current state + immutable event log" là dựng lại được dòng thời gian
 * ("01/01 → 14/06: Engineering, 15/06 → nay: Product") mà không cần temporal DB.
 */

/** Loại điều chuyển tổ chức — quyết định trường nào bắt buộc. */
export const MOVEMENT_TYPE = [
  'department_transfer',
  'position_change',
  'promotion',
  'manager_change',
] as const;
export type MovementType = (typeof MOVEMENT_TYPE)[number];

/** Loại kết thúc hợp tác. */
export const SEPARATION_TYPE = ['resignation', 'termination'] as const;
export type SeparationType = (typeof SEPARATION_TYPE)[number];

/** Movement type → eventType lưu vào employeeHistories. */
export const MOVEMENT_EVENT: Record<MovementType, string> = {
  department_transfer: 'transfer',
  position_change: 'position_change',
  promotion: 'promotion',
  manager_change: 'manager_change',
};

/** Separation type → eventType. `terminated` giữ nguyên tên cũ cho dữ liệu cũ. */
export const SEPARATION_EVENT: Record<SeparationType, string> = {
  resignation: 'resigned',
  termination: 'terminated',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ngày hiệu lực không được xa hơn 2 năm so với hiện tại (cả hai chiều). */
export const MAX_EFFECTIVE_DRIFT_DAYS = 730;

export interface EffectiveDateCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Kiểm tra ngày hiệu lực. Cho phép ghi nhận lùi (HR nhập bù) và ghi nhận trước
 * (quyết định đã ký, có hiệu lực sau), nhưng chặn ngày vô lý và ngày trước khi
 * nhân viên vào làm — vì lịch sử khi đó không thể giải thích được.
 */
export function checkEffectiveDate(
  effectiveDate: Date,
  now: Date,
  hireDate?: Date | null,
): EffectiveDateCheck {
  const t = effectiveDate.getTime();
  if (!Number.isFinite(t)) return { ok: false, reason: 'Ngày hiệu lực không hợp lệ' };

  const drift = Math.abs(t - now.getTime()) / DAY_MS;
  if (drift > MAX_EFFECTIVE_DRIFT_DAYS) {
    return { ok: false, reason: 'Ngày hiệu lực lệch quá 2 năm so với hiện tại' };
  }
  if (hireDate && t < new Date(hireDate).setHours(0, 0, 0, 0)) {
    return { ok: false, reason: 'Ngày hiệu lực không được trước ngày vào làm' };
  }
  return { ok: true };
}

/**
 * Phát hiện vòng lặp quản lý. `chainUpwards` là chuỗi id quản lý đi LÊN bắt đầu
 * từ người quản lý mới (đã bao gồm chính người quản lý mới). Nếu nhân viên nằm
 * trong chuỗi đó thì gán sẽ tạo vòng: A quản lý B, B quản lý A.
 */
export function wouldCreateManagerCycle(
  employeeId: string,
  newManagerId: string,
  chainUpwards: readonly string[],
): boolean {
  if (employeeId === newManagerId) return true;
  return chainUpwards.includes(employeeId);
}

/** So sánh hai tham chiếu id (null/undefined coi như "không có"). */
export function sameRef(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
  return norm(a) === norm(b);
}

export interface MovementChange {
  field: 'departmentId' | 'positionId' | 'managerId';
  from: string | null;
  to: string | null;
}

/**
 * Rút ra danh sách thay đổi thực sự của một movement. Trả mảng rỗng nghĩa là
 * người dùng bấm "chuyển" nhưng không đổi gì — phải chặn thay vì ghi một bản ghi
 * lịch sử rỗng nghĩa.
 */
export function collectMovementChanges(
  current: { departmentId?: unknown; positionId?: unknown; managerId?: unknown },
  next: { departmentId?: string | null; positionId?: string | null; managerId?: string | null },
): MovementChange[] {
  const out: MovementChange[] = [];
  const push = (field: MovementChange['field'], from: unknown, to: string | null | undefined) => {
    if (to === undefined) return;
    if (sameRef(from, to)) return;
    out.push({ field, from: from == null ? null : String(from), to: to == null ? null : String(to) });
  };
  push('departmentId', current.departmentId, next.departmentId);
  push('positionId', current.positionId, next.positionId);
  push('managerId', current.managerId, next.managerId);
  return out;
}

/** `fromValue`/`toValue` cho employeeHistories, dựng từ danh sách thay đổi. */
export function changesToHistoryValues(changes: readonly MovementChange[]): {
  fromValue: Record<string, unknown>;
  toValue: Record<string, unknown>;
} {
  const fromValue: Record<string, unknown> = {};
  const toValue: Record<string, unknown> = {};
  for (const c of changes) {
    fromValue[c.field] = c.from;
    toValue[c.field] = c.to;
  }
  return { fromValue, toValue };
}

/**
 * Trạng thái nhân viên sau khi hoàn tất thử việc. Nhân viên đang `onboarding`
 * chuyển sang `active`; các trạng thái khác giữ nguyên (không tự ý hồi sinh
 * người đã nghỉ).
 */
export function statusAfterProbationCompleted(current: string): string {
  return current === 'onboarding' ? 'active' : current;
}

/** Nhân viên đã rời công ty thì không nhận thêm thay đổi vòng đời nào nữa. */
export function isSeparated(status: string): boolean {
  return status === 'terminated';
}
