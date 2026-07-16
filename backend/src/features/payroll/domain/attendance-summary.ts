/**
 * Pure attendance aggregation for payroll. No I/O — the DB query lives in the
 * infrastructure attendance gateway, which feeds `AttendanceRow[]` in here.
 *
 * Records are stored per session, so each contributes a weight:
 *   full_day = 1 · morning = 0.5 · afternoon = 0.5
 *
 * Status → category:
 *   present | late | early_leave  → worked (paid, counts as work)
 *   incomplete                    → NOT counted as a paid work day (missing
 *                                   check-out) — tracked separately so HR fixes
 *                                   it before payroll close; until then it does
 *                                   not inflate the attendance ratio
 *   leave_paid                    → paid leave (paid, not "worked")
 *   holiday                       → holiday   (neutral — see below)
 *   leave_unpaid                  → unpaid leave (reduces pay)
 *   absent                        → absence      (reduces pay)
 *
 * `actualWorkDays` = paid days (worked + paid leave) so the attendanceRatio
 * does not penalise approved paid leave; `unpaidDays` = unpaid leave + absence.
 *
 * Holidays are NEUTRAL for the ratio: `standardWorkDays` already EXCLUDES
 * public holidays, so a manually-entered `holiday` row must not add to
 * `actualWorkDays` — otherwise it would inflate the ratio and mask unpaid
 * absence in the same period (e.g. 20 worked + 1 holiday over a 21-day
 * standard would read as full attendance despite 1 unpaid day). Holiday pay
 * is implicit: the day is out of both the numerator and the denominator.
 */
import type { AttendanceSession, AttendanceStatus } from '@shared/models/attendance.model';

export interface AttendanceRow {
  session: AttendanceSession;
  status: AttendanceStatus;
  workHours?: number | null;
  /** Công this record contributes = 1/(số ca trong ngày). Falls back to the
   *  session weight when absent (legacy/leave rows). */
  congWeight?: number | null;
}

export interface AttendanceSummary {
  workedDays: number;
  paidLeaveDays: number;
  holidayDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  /** Check-in but no check-out — not paid until corrected. */
  incompleteDays: number;
  /** Paid days counting toward salary: worked + paid leave (holidays are
   *  neutral — already excluded from standardWorkDays). */
  actualWorkDays: number;
  /** Days not paid: unpaid leave + absence. */
  unpaidDays: number;
  totalWorkHours: number;
  recordCount: number;
}

const SESSION_WEIGHT: Record<AttendanceSession, number> = {
  morning: 0.5,
  afternoon: 0.5,
  full_day: 1,
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Pure reducer — no I/O, unit-testable. */
export function summarizeAttendance(rows: AttendanceRow[]): AttendanceSummary {
  let workedDays = 0;
  let paidLeaveDays = 0;
  let holidayDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let incompleteDays = 0;
  let totalWorkHours = 0;

  for (const row of rows) {
    // Prefer the stored per-record công (1/N ca in the day); fall back to the
    // session weight for legacy/leave rows without an explicit congWeight.
    const weight = row.congWeight ?? SESSION_WEIGHT[row.session] ?? 1;
    switch (row.status) {
      // `late` / `early_leave` are tracked for the record but count as a FULL
      // paid work day — lateness has no reward/penalty effect on pay (company
      // policy: companyConfig.lateAffectsPay = false).
      case 'present':
      case 'late':
      case 'early_leave':
        workedDays += weight;
        totalWorkHours += row.workHours ?? 0;
        break;
      // Checked in but never checked out: not a payable day until HR corrects
      // it. Excluded from actualWorkDays so it can't inflate the ratio.
      case 'incomplete':
        incompleteDays += weight;
        break;
      case 'leave_paid':
        paidLeaveDays += weight;
        break;
      case 'holiday':
        holidayDays += weight;
        break;
      case 'leave_unpaid':
        unpaidLeaveDays += weight;
        break;
      case 'absent':
        absentDays += weight;
        break;
    }
  }

  return {
    workedDays: round2(workedDays),
    paidLeaveDays: round2(paidLeaveDays),
    holidayDays: round2(holidayDays),
    unpaidLeaveDays: round2(unpaidLeaveDays),
    absentDays: round2(absentDays),
    incompleteDays: round2(incompleteDays),
    actualWorkDays: round2(workedDays + paidLeaveDays),
    unpaidDays: round2(unpaidLeaveDays + absentDays),
    totalWorkHours: round2(totalWorkHours),
    recordCount: rows.length,
  };
}

/** Subset of IPayroll work-day fields, derived from a summary + the period standard. */
export interface PayrollWorkDays {
  standardWorkDays: number;
  actualWorkDays: number;
  unpaidLeaveDays: number;
  workDays: number;
  leaveDays: number;
}

export function toPayrollWorkDays(
  summary: AttendanceSummary,
  standardWorkDays: number,
): PayrollWorkDays {
  return {
    standardWorkDays,
    actualWorkDays: summary.actualWorkDays,
    unpaidLeaveDays: summary.unpaidDays,
    workDays: summary.workedDays,
    leaveDays: summary.paidLeaveDays,
  };
}

const FULL_DAY_OVERRIDE: ReadonlySet<AttendanceStatus> = new Set([
  'leave_paid',
  'leave_unpaid',
  'holiday',
]);

/**
 * Defence-in-depth against double-counting: a full-day leave/holiday row (which
 * has shiftId:null and thus escapes the per-shift unique index) can coexist with
 * a `present` punch on the same day. When that happens the full-day leave/holiday
 * supersedes every other record for that calendar day, so payroll counts the day
 * once. Days without such an override pass through unchanged.
 */
export function dedupeByDay<T extends AttendanceRow & { date: Date }>(rows: T[]): AttendanceRow[] {
  const overrideByDay = new Map<number, T>();
  for (const r of rows) {
    if (r.session === 'full_day' && FULL_DAY_OVERRIDE.has(r.status)) {
      overrideByDay.set(r.date.getTime(), r);
    }
  }
  if (overrideByDay.size === 0) return rows;
  return rows.filter((r) => {
    const override = overrideByDay.get(r.date.getTime());
    return !override || r === override;
  });
}
