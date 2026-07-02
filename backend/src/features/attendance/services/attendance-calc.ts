import type { AttendanceStatus, AttendanceSession } from '@shared/models/attendance.model';

// Defaults (E2) — used only when no config is supplied. Actual values come
// from CompanyConfig (timezone + grace), set by Admin/HR in Settings.
export const TIMEZONE = 'Asia/Ho_Chi_Minh';
export const GRACE_LATE_MIN = 5;
export const GRACE_EARLY_MIN = 5;

export interface AttendancePolicy {
  timezone: string;
  graceLateMin: number;
  graceEarlyMin: number;
}

export const DEFAULT_POLICY: AttendancePolicy = {
  timezone: TIMEZONE,
  graceLateMin: GRACE_LATE_MIN,
  graceEarlyMin: GRACE_EARLY_MIN,
};

export interface ShiftWindow {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  breakMinutes: number;
}

export interface ComputeInput {
  shift: ShiftWindow;
  checkIn?: Date | null;
  checkOut?: Date | null;
  policy?: AttendancePolicy;
}

export interface ComputeResult {
  status: AttendanceStatus;
  workHours: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  /** Worked session derived from time-in/out vs the shift's morning/afternoon
   *  windows: full_day (1 công) · morning|afternoon (0.5 công) · null when N/A. */
  session: AttendanceSession | null;
}

/** Minutes since local midnight (in tz), from a UTC instant (DST-safe). */
export function minutesOfDayVN(d: Date, tz: string = TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hh * 60 + mm;
}

/** Local calendar Y/M/D of an instant (in tz). */
function localYMD(d: Date, tz: string): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return { y: get('year'), m: get('month'), day: get('day') };
}

/** Pure date-key (00:00 UTC) for the local calendar date of an instant. */
export function vnDateKey(d: Date, tz: string = TIMEZONE): Date {
  const { y, m, day } = localYMD(d, tz);
  return new Date(Date.UTC(y, m - 1, day));
}

/** [start, end) date-keys for a "YYYY-MM" month. */
export function vnMonthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 1));
  return { start, end };
}

/** Enumerate inclusive UTC date-keys (00:00 UTC) from start..end. */
export function enumerateDays(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const s = vnDateKey(start);
  const e = vnDateKey(end);
  for (let t = s.getTime(); t <= e.getTime(); t += 86_400_000) {
    out.push(new Date(t));
  }
  return out;
}

/** Saturday or Sunday in UTC terms (date-keys are stored at 00:00 UTC). */
export function isWeekend(dateKey: Date): boolean {
  const dow = dateKey.getUTCDay(); // 0 = Sun, 6 = Sat
  return dow === 0 || dow === 6;
}

/** "MM-DD" of a UTC date-key — used to match recurring holidays. */
export function mmddKey(dateKey: Date): string {
  const mm = String(dateKey.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dateKey.getUTCDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

function parseHHmm(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Which worked session(s) a [checkIn, checkOut] interval covers, given the
 * shift split into a morning half `[start, break]` and afternoon half
 * `[break, end]`. A half counts as worked when the interval spans that half's
 * midpoint. Returns full_day (both halves), morning|afternoon (one), or null.
 */
export function deriveWorkedSession(
  shift: ShiftWindow,
  checkIn?: Date | null,
  checkOut?: Date | null,
  policy: AttendancePolicy = DEFAULT_POLICY,
): AttendanceSession | null {
  if (!checkIn || !checkOut) return null;
  const start = parseHHmm(shift.startTime);
  const end = parseHHmm(shift.endTime);
  const brk = shift.breakMinutes ?? 0;
  const effIn = Math.max(minutesOfDayVN(checkIn, policy.timezone), start);
  const effOut = Math.min(minutesOfDayVN(checkOut, policy.timezone), end);
  if (effOut <= effIn) return null;

  const mid = (start + end) / 2;
  const morningEnd = mid - brk / 2; // lunch break centred on the midpoint
  const afternoonStart = mid + brk / 2;
  const morningMid = (start + morningEnd) / 2;
  const afternoonMid = (afternoonStart + end) / 2;
  const covers = (m: number) => effIn <= m && effOut >= m;

  const morn = covers(morningMid);
  const aft = covers(afternoonMid);
  if (morn && aft) return 'full_day';
  if (morn) return 'morning';
  if (aft) return 'afternoon';
  return null;
}

/**
 * Compute attendance status & worked hours from check-in/out times against a
 * shift. All time comparisons happen in VN local time. Leave/holiday/absent
 * statuses are decided by the service layer, not here.
 */
export function computeAttendance(input: ComputeInput): ComputeResult {
  const { shift, checkIn, checkOut } = input;
  const policy = input.policy ?? DEFAULT_POLICY;
  const start = parseHHmm(shift.startTime);
  const end = parseHHmm(shift.endTime);
  const brk = shift.breakMinutes ?? 0;

  if (!checkIn) {
    return { status: 'absent', workHours: 0, lateMinutes: 0, earlyMinutes: 0, session: null };
  }

  const inMin = minutesOfDayVN(checkIn, policy.timezone);
  const isLate = inMin > start + policy.graceLateMin;
  const lateMinutes = isLate ? inMin - start : 0;

  if (!checkOut) {
    return { status: 'incomplete', workHours: null, lateMinutes, earlyMinutes: 0, session: null };
  }

  const outMin = minutesOfDayVN(checkOut, policy.timezone);
  const isEarly = outMin < end - policy.graceEarlyMin;
  const earlyMinutes = isEarly ? end - outMin : 0;

  const effectiveIn = Math.max(inMin, start);
  const effectiveOut = Math.min(outMin, end);
  const worked = Math.max(0, effectiveOut - effectiveIn - brk); // integer minutes
  const workHours = round2(worked / 60);

  const status: AttendanceStatus = isLate ? 'late' : isEarly ? 'early_leave' : 'present';
  // Half vs full day auto-derived from the covered session(s); fall back to a
  // full day when present but the interval is ambiguous.
  const session = deriveWorkedSession(shift, checkIn, checkOut, policy) ?? 'full_day';
  return { status, workHours, lateMinutes, earlyMinutes, session };
}
