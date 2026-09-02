/**
 * Working-day calendar helpers for payroll's attendance denominator.
 *
 * `standardWorkDays` must reflect the real number of working days in a period —
 * i.e. exclude weekends AND public holidays — otherwise an employee with perfect
 * attendance gets a ratio < 1 in any month containing a holiday.
 */

/** UTC date-key 'YYYY-MM-DD' (attendance.date is stored at 00:00 UTC). */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ISO weekday 1..7 (Mon=1 … Sun=7) in UTC. */
function isoWeekday(d: Date): number {
  const wd = d.getUTCDay(); // 0=Sun..6=Sat
  return wd === 0 ? 7 : wd;
}

/**
 * Count working days in the inclusive [start, end] range:
 * weekday must be in `workingDays` (default Mon–Fri) and the date must not be a
 * holiday (`holidayKeys` is a set of 'YYYY-MM-DD').
 */
export function computeStandardWorkDays(
  start: Date,
  end: Date,
  holidayKeys: Set<string> = new Set(),
  workingDays: number[] = [1, 2, 3, 4, 5],
): number {
  const working = new Set(workingDays);
  let count = 0;
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur.getTime() <= last.getTime()) {
    if (working.has(isoWeekday(cur)) && !holidayKeys.has(dateKey(cur))) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}
