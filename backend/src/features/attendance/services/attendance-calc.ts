import type { AttendanceStatus } from '@shared/models/attendance.model';

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

function parseHHmm(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
    return { status: 'absent', workHours: 0, lateMinutes: 0, earlyMinutes: 0 };
  }

  const inMin = minutesOfDayVN(checkIn, policy.timezone);
  const isLate = inMin > start + policy.graceLateMin;
  const lateMinutes = isLate ? inMin - start : 0;

  if (!checkOut) {
    return { status: 'incomplete', workHours: null, lateMinutes, earlyMinutes: 0 };
  }

  const outMin = minutesOfDayVN(checkOut, policy.timezone);
  const isEarly = outMin < end - policy.graceEarlyMin;
  const earlyMinutes = isEarly ? end - outMin : 0;

  const effectiveIn = Math.max(inMin, start);
  const effectiveOut = Math.min(outMin, end);
  const worked = Math.max(0, effectiveOut - effectiveIn - brk); // integer minutes
  const workHours = round2(worked / 60);

  const status: AttendanceStatus = isLate ? 'late' : isEarly ? 'early_leave' : 'present';
  return { status, workHours, lateMinutes, earlyMinutes };
}
