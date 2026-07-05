import type { AttendanceStatus, AttendanceSession } from '@shared/models/attendance.model';
import {
  computeAttendance,
  vnDateKey,
  enumerateDays,
  isWeekend,
  mmddKey,
  type AttendancePolicy,
  type ShiftWindow,
} from '@features/attendance/domain/attendance-calc';

// --- Annual-leave policy: official employees get 12 days/year; unused days
// carry over and stay usable for up to 3 years (pooled: current + 2 prior). ---
export const DEFAULT_ANNUAL_LEAVE = 12;
export const CARRYOVER_YEARS = 3;

/** Framework-free 24-hex ObjectId shape check (keeps the domain mongoose-free). */
export function isObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/** Resolve the annual quota from a (possibly missing) configured value. */
export function annualQuotaFrom(configured?: number | null): number {
  const q = Number(configured);
  return Number.isFinite(q) && q > 0 ? q : DEFAULT_ANNUAL_LEAVE;
}

/** Inclusive year window [year - (CARRYOVER_YEARS-1), year] for the pool. */
export function carryoverWindow(year: number): { from: number; to: number } {
  return { from: year - (CARRYOVER_YEARS - 1), to: year };
}

/** Pooled remaining = max(0, Σ entitled − Σ used) over the given balance rows. */
export function poolAnnualRemaining(rows: { entitled?: number; used?: number }[]): number {
  let entitled = 0;
  let used = 0;
  for (const b of rows) {
    entitled += b.entitled ?? 0;
    used += b.used ?? 0;
  }
  return Math.max(0, entitled - used);
}

export interface HolidayRow {
  date: Date;
  isRecurring?: boolean;
}

/** Predicate telling whether a UTC date-key is a public holiday. */
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

/** Working days in [start, end], excluding weekends and holidays. Half-day = 0.5. */
export function countWorkingDays(
  start: Date,
  end: Date,
  half: string | null | undefined,
  isHoliday: (d: Date) => boolean,
): number {
  // Half-day only counts if that single day is actually a working day —
  // otherwise a half-day filed on a weekend/holiday would wrongly deduct 0.5.
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

/** Working date-keys an approved leave covers (excludes weekends/holidays). */
export function leaveDays(
  start: Date,
  end: Date,
  halfDaySession: string | null | undefined,
  isHoliday: (d: Date) => boolean,
): Date[] {
  const raw = halfDaySession ? [vnDateKey(start)] : enumerateDays(start, end);
  return raw.filter((d) => !isWeekend(d) && !isHoliday(d));
}

/** Whole months worked from hireDate to now (≥ 0). */
export function monthsSince(hire?: Date | null, nowMs: number = Date.now()): number {
  if (!hire) return 0;
  const h = new Date(hire);
  const n = new Date(nowMs);
  let m = (n.getFullYear() - h.getFullYear()) * 12 + (n.getMonth() - h.getMonth());
  if (n.getDate() < h.getDate()) m -= 1;
  return Math.max(0, m);
}

export const MANUAL_STATUSES = ['leave_paid', 'leave_unpaid', 'holiday', 'absent'] as const;
export type ManualStatus = (typeof MANUAL_STATUSES)[number];

export function isManualStatus(s?: string): s is ManualStatus {
  return !!s && (MANUAL_STATUSES as readonly string[]).includes(s);
}

export interface ComputedFields {
  status: AttendanceStatus;
  workHours: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  session: AttendanceSession;
  checkIn: Date | null;
  checkOut: Date | null;
}

/**
 * Derive the persisted attendance fields for a record. Manual leave/holiday/
 * absent = whole day with no hours; otherwise compute from check-in/out times.
 */
export function computeFields(
  window: ShiftWindow,
  policy: AttendancePolicy,
  input: { status?: string; checkIn?: Date | null; checkOut?: Date | null },
): ComputedFields {
  if (isManualStatus(input.status)) {
    return {
      status: input.status,
      workHours: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      session: 'full_day',
      checkIn: null,
      checkOut: null,
    };
  }
  const r = computeAttendance({ shift: window, checkIn: input.checkIn, checkOut: input.checkOut, policy });
  return {
    ...r,
    session: r.session ?? 'full_day',
    checkIn: input.checkIn ?? null,
    checkOut: input.checkOut ?? null,
  };
}
