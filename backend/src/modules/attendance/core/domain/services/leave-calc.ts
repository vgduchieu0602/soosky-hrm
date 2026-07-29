import { enumerateDays, isWeekend, mmddKey, vnDateKey } from "@modules/attendance/core/domain/services/attendance-calc";

/**
 * Logic thuần cho nghỉ phép — số ngày làm việc trong khoảng, kiểm tra ngày
 * lễ, và cộng dồn (carryover) phép năm. Port từ `leave-policy.ts` bản cũ.
 */

export const DEFAULT_ANNUAL_LEAVE = 12;
export const CARRYOVER_YEARS = 3;

/** Hạn mức phép năm hiệu lực từ giá trị cấu hình (nếu có), fallback về mặc định. */
export function annualQuotaFrom(configured?: number | null): number {
    const q = Number(configured);
    return Number.isFinite(q) && q > 0 ? q : DEFAULT_ANNUAL_LEAVE;
}

/** Khoảng năm [year - (CARRYOVER_YEARS-1), year] tính bể phép cộng dồn. */
export function carryoverWindow(year: number): { from: number; to: number } {
    return { from: year - (CARRYOVER_YEARS - 1), to: year };
}

/** Số phép năm còn lại dạng bể = max(0, Σ entitled − Σ used) trên các dòng số dư truyền vào. */
export function poolAnnualRemaining(rows: { entitled: number; used: number }[]): number {
    let entitled = 0;
    let used = 0;
    for (const row of rows) {
        entitled += row.entitled;
        used += row.used;
    }
    return Math.max(0, entitled - used);
}

export interface HolidayRow {
    date:        Date;
    isRecurring: boolean;
}

/** Predicate kiểm tra một date-key UTC có phải ngày lễ hay không. */
export function buildHolidayChecker(holidays: HolidayRow[]): (d: Date) => boolean {
    const fixed = new Set<number>();
    const recurring = new Set<string>();
    for (const h of holidays) {
        const key = vnDateKey(h.date);
        if (h.isRecurring) recurring.add(mmddKey(key));
        else fixed.add(key.getTime());
    }
    return (d: Date) => fixed.has(d.getTime()) || recurring.has(mmddKey(d));
}

/** Số ngày làm việc trong [start, end], loại cuối tuần và ngày lễ. Nửa ngày = 0.5. */
export function countWorkingDays(
    start:     Date,
    end:       Date,
    half:      boolean,
    isHoliday: (d: Date) => boolean,
): number {
    if (half) {
        const day = vnDateKey(start);
        return isWeekend(day) || isHoliday(day) ? 0 : 0.5;
    }
    let count = 0;
    for (const day of enumerateDays(start, end)) {
        if (isWeekend(day) || isHoliday(day)) continue;
        count += 1;
    }
    return count;
}

/** Các date-key làm việc mà một đơn nghỉ đã duyệt bao phủ (loại cuối tuần/ngày lễ). */
export function leaveDays(
    start:          Date,
    end:            Date,
    halfDaySession: string | null,
    isHoliday:      (d: Date) => boolean,
): Date[] {
    const raw = halfDaySession ? [vnDateKey(start)] : enumerateDays(start, end);
    return raw.filter(d => !isWeekend(d) && !isHoliday(d));
}
