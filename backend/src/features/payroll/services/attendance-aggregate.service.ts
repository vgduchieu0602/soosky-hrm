/**
 * Aggregates raw attendance records for one employee over a payroll period into
 * the work-day figures the payroll engine needs.
 *
 * Records are stored per session, so each contributes a weight:
 *   full_day = 1 · morning = 0.5 · afternoon = 0.5
 *
 * Status → category:
 *   present | late | early_leave | incomplete → worked (paid, counts as work)
 *   leave_paid                                 → paid leave (paid, not "worked")
 *   holiday                                    → holiday   (paid, not "worked")
 *   leave_unpaid                               → unpaid leave (reduces pay)
 *   absent                                     → absence      (reduces pay)
 *
 * `actualWorkDays` = paid days (worked + paid leave + holiday) so the
 * attendanceRatio does not penalise approved paid leave or public holidays;
 * `unpaidDays` = unpaid leave + absence.
 */
import { Attendance, type AttendanceSession, type AttendanceStatus } from '@shared/models/attendance.model';

export interface AttendanceRow {
  session: AttendanceSession;
  status: AttendanceStatus;
  workHours?: number | null;
}

export interface AttendanceSummary {
  workedDays: number;
  paidLeaveDays: number;
  holidayDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  /** Paid days counting toward salary: worked + paid leave + holiday. */
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
  let totalWorkHours = 0;

  for (const row of rows) {
    const weight = SESSION_WEIGHT[row.session] ?? 1;
    switch (row.status) {
      // `late` / `early_leave` are tracked for the record but count as a FULL
      // paid work day — lateness has no reward/penalty effect on pay (company
      // policy: companyConfig.lateAffectsPay = false).
      case 'present':
      case 'late':
      case 'early_leave':
      case 'incomplete':
        workedDays += weight;
        totalWorkHours += row.workHours ?? 0;
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
    actualWorkDays: round2(workedDays + paidLeaveDays + holidayDays),
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

/**
 * Query + summarize one employee's attendance for a period.
 * `start`/`end` are inclusive 00:00-UTC date-keys (as stored on attendance.date).
 */
export async function aggregatePeriodAttendance(
  employeeId: string,
  start: Date,
  end: Date,
): Promise<AttendanceSummary> {
  const rows = await Attendance.find({ employeeId, date: { $gte: start, $lte: end } })
    .select('session status workHours')
    .lean<AttendanceRow[]>();
  return summarizeAttendance(rows);
}
