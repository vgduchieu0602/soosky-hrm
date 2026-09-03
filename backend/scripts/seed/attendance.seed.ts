/**
 * Attendance for the whole demo window.
 *
 * The seed only decides the *inputs* — which shift, what time someone punched in
 * and out, or which manual status applies. Every derived field (status,
 * workHours, lateMinutes, earlyMinutes, session) comes from `computeFields`, the
 * same domain function the HTTP layer calls. Hard-coding those is how a demo
 * database ends up with a `late` row claiming a full 8 worked hours.
 *
 * Coverage is not cosmetic either: `periodUseCases.lockAttendance` refuses to
 * lock a period unless EVERY employee in the run scope has at least one record
 * and none of them is `incomplete`. So the closed periods are filled for the
 * entire roster, and the deliberate `incomplete` rows live only in the current,
 * still-open month.
 *
 * The current month is filled for its whole calendar, future working days
 * included. Stopping at today is more truthful, but seeding on the 3rd of a
 * month leaves the attendance grid — which opens on the current month — with a
 * day or two of data and reads as "the seed didn't run". Demo data being ahead
 * of the clock is the cheaper problem.
 */
import mongoose from 'mongoose';
import { Attendance } from '@modules/hrm/adapters/persistence/mongoose/models/attendance.model';
import { Shift } from '@modules/hrm/adapters/persistence/mongoose/models/shift.model';
import { CompanyConfig } from '@modules/hrm/adapters/persistence/mongoose/models/company-config.model';
import { computeFields } from '@modules/hrm/core/attendance/domain/leave-policy';
import {
  DEFAULT_POLICY,
  isWeekend,
  type AttendancePolicy,
  type ShiftWindow,
} from '@modules/hrm/core/attendance/domain/attendance-calc';
import { holidayKeysInRange } from '@modules/hrm/adapters/persistence/mongoose/payroll/workdays';
import { dateKey } from '@modules/hrm/core/payroll/domain/workdays.util';
import { utcDay, daysInMonth, makeRng, line } from './common';
import type { SeededEmployee } from './employee.seed';
import type { SeededPeriod } from './period.seed';

type Id = mongoose.Types.ObjectId;

/** Employees whose current month is cut short / left broken on purpose. */
const INCOMPLETE_IN_CURRENT_MONTH = ['EMP006', 'EMP014'];
const ON_LEAVE_LAST_DAY = 10;

const parseHHmm = (v: string): number => {
  const [h, m] = v.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** VN minute-of-day on a calendar date → the UTC instant it maps to (VN = UTC+7). */
const vnAtMinute = (y: number, m: number, d: number, minute: number) =>
  new Date(Date.UTC(y, m - 1, d, 0, minute - 7 * 60));

interface DayInput {
  status?: string;
  checkIn: Date | null;
  checkOut: Date | null;
  note: string | null;
}

/**
 * Pick one realistic day for an employee. Weighted so the vast majority of days
 * are ordinary attendance — the point of the odd late/early/absent day is that
 * the dashboards and payroll ratios have something other than a flat 100%.
 */
function pickDay(
  rng: ReturnType<typeof makeRng>,
  window: ShiftWindow,
  y: number,
  m: number,
  d: number,
): DayInput {
  const start = parseHHmm(window.startTime);
  const end = parseHHmm(window.endTime);
  const brk = window.breakMinutes ?? 0;
  const mid = start + Math.floor((end - start) / 2);
  const at = (minute: number) => vnAtMinute(y, m, d, minute);
  const roll = rng.next();

  if (roll < 0.78) {
    return { checkIn: at(start + rng.int(0, 4)), checkOut: at(end + rng.int(0, 20)), note: null };
  }
  if (roll < 0.87) {
    return { checkIn: at(start + rng.int(12, 45)), checkOut: at(end + rng.int(0, 15)), note: 'Đi muộn do tắc đường' };
  }
  if (roll < 0.93) {
    return { checkIn: at(start + rng.int(0, 4)), checkOut: at(end - rng.int(10, 40)), note: 'Về sớm có xin phép' };
  }
  if (roll < 0.96) {
    // Half a day worked — `deriveWorkedSession` turns this into morning/afternoon
    // (0.5 công) on its own.
    return rng.chance(0.5)
      ? { checkIn: at(start), checkOut: at(mid - Math.floor(brk / 2)), note: 'Làm buổi sáng' }
      : { checkIn: at(mid + Math.floor(brk / 2)), checkOut: at(end), note: 'Làm buổi chiều' };
  }
  return { status: 'absent', checkIn: null, checkOut: null, note: 'Vắng không phép' };
}

export async function seedAttendance(
  employees: SeededEmployee[],
  periods: SeededPeriod[],
): Promise<{ inserted: number; byStatus: Record<string, number> }> {
  const shifts = await Shift.find({}).select('_id name startTime endTime breakMinutes').lean();
  const windowByShift = new Map<string, ShiftWindow>(
    shifts.map((s) => [String(s._id), { startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes ?? 0 }]),
  );

  const cfg = await CompanyConfig.findOne({ key: 'global' }).lean();
  const policy: AttendancePolicy = {
    timezone: cfg?.timezone ?? DEFAULT_POLICY.timezone,
    graceLateMin: cfg?.graceLateMinutes ?? DEFAULT_POLICY.graceLateMin,
    graceEarlyMin: cfg?.graceEarlyMinutes ?? DEFAULT_POLICY.graceEarlyMin,
  };

  const from = periods[0]!.start;
  const to = periods[periods.length - 1]!.end;
  const holidayKeys = await holidayKeysInRange(from, to);

  // Sessions already covered by the leave step — a full-day leave takes the day,
  // a half-day leave leaves the other half open for a worked record.
  const existing = await Attendance.find({
    employeeId: { $in: employees.map((e) => e.id) },
    date: { $gte: from, $lte: to },
  })
    .select('employeeId date session')
    .lean();
  const covered = new Map<string, Set<string>>();
  for (const row of existing) {
    const key = `${String(row.employeeId)}|${new Date(row.date).getTime()}`;
    if (!covered.has(key)) covered.set(key, new Set());
    covered.get(key)!.add(row.session);
  }

  const docs: Record<string, unknown>[] = [];
  const byStatus: Record<string, number> = {};

  for (const period of periods) {
    const isCurrentMonth = period.offset === 0;

    for (const employee of employees) {
      // Same membership rule the payroll run uses: on the payroll of any period
      // their employment overlaps, regardless of today's status.
      const inScope =
        employee.hireDate.getTime() <= period.end.getTime() &&
        (employee.terminationDate === null || employee.terminationDate.getTime() >= period.start.getTime());
      if (!inScope) continue;

      const window = windowByShift.get(String(employee.shiftId));
      if (!window) continue;

      // Seeded per employee + period so each person keeps a stable pattern and
      // adding a period does not reshuffle the earlier ones.
      const rng = makeRng(period.year * 10_000 + period.month * 100 + Number(employee.code.slice(3)));

      for (let d = 1; d <= daysInMonth(period.year, period.month); d++) {
        const date = utcDay(period.year, period.month, d);
        if (isWeekend(date) || holidayKeys.has(dateKey(date))) continue;
        if (date.getTime() < employee.hireDate.getTime()) continue;
        if (employee.terminationDate && date.getTime() > employee.terminationDate.getTime()) continue;
        // Someone currently on leave stops appearing partway through this month.
        if (isCurrentMonth && employee.seed.status === 'on_leave' && d > ON_LEAVE_LAST_DAY) continue;

        const key = `${String(employee.id)}|${date.getTime()}`;
        const sessions = covered.get(key);
        if (sessions?.has('full_day')) continue;

        let input = pickDay(rng, window, period.year, period.month, d);

        // Complement a half-day leave with the half that was actually worked.
        if (sessions?.has('morning')) {
          const mid = parseHHmm(window.startTime) + Math.floor((parseHHmm(window.endTime) - parseHHmm(window.startTime)) / 2);
          input = {
            checkIn: vnAtMinute(period.year, period.month, d, mid + Math.floor((window.breakMinutes ?? 0) / 2)),
            checkOut: vnAtMinute(period.year, period.month, d, parseHHmm(window.endTime)),
            note: 'Làm buổi chiều (nghỉ phép buổi sáng)',
          };
        } else if (sessions?.has('afternoon')) {
          const mid = parseHHmm(window.startTime) + Math.floor((parseHHmm(window.endTime) - parseHHmm(window.startTime)) / 2);
          input = {
            checkIn: vnAtMinute(period.year, period.month, d, parseHHmm(window.startTime)),
            checkOut: vnAtMinute(period.year, period.month, d, mid - Math.floor((window.breakMinutes ?? 0) / 2)),
            note: 'Làm buổi sáng (nghỉ phép buổi chiều)',
          };
        }

        // A missing check-out blocks `lockAttendance`, so it is only ever seeded
        // into the open month — where showing HR that blocker is the point.
        if (isCurrentMonth && INCOMPLETE_IN_CURRENT_MONTH.includes(employee.code) && d === 3) {
          input = { checkIn: vnAtMinute(period.year, period.month, d, parseHHmm(window.startTime)), checkOut: null, note: 'Quên check-out' };
        }

        const fields = computeFields(window, policy, input);
        byStatus[fields.status] = (byStatus[fields.status] ?? 0) + 1;
        docs.push({
          employeeId: employee.id,
          date,
          session: fields.session,
          shiftId: employee.shiftId,
          checkIn: fields.checkIn,
          checkOut: fields.checkOut,
          status: fields.status,
          workHours: fields.workHours,
          lateMinutes: fields.lateMinutes,
          earlyMinutes: fields.earlyMinutes,
          source: 'manual',
          note: input.note,
        });
      }
    }
  }

  if (docs.length > 0) await Attendance.insertMany(docs, { ordered: false });

  line('Attendance rows', docs.length);
  line('  by status', Object.entries(byStatus).map(([k, v]) => `${k} ${v}`).join(', '));
  return { inserted: docs.length, byStatus };
}

/** Attendance rows the leave step generated, for the summary. */
export async function countLeaveAttendance(employeeIds: Id[]): Promise<number> {
  return Attendance.countDocuments({ employeeId: { $in: employeeIds }, source: 'leave' });
}
