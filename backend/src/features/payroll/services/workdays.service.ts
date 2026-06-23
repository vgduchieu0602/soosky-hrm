import { Holiday } from '@shared/models/holiday.model';
import { computeStandardWorkDays, dateKey } from '@shared/utils/workdays.util';

/** Date-keys of public holidays within [start, end], honouring recurring (MM-DD) ones. */
export async function holidayKeysInRange(start: Date, end: Date): Promise<Set<string>> {
  const holidays = await Holiday.find({}).select('date isRecurring').lean();
  const keys = new Set<string>();
  const startMs = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  for (const h of holidays) {
    const d = new Date(h.date);
    if (h.isRecurring) {
      for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y += 1) {
        const ms = Date.UTC(y, d.getUTCMonth(), d.getUTCDate());
        if (ms >= startMs && ms <= endMs) keys.add(dateKey(new Date(ms)));
      }
    } else {
      const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      if (ms >= startMs && ms <= endMs) keys.add(dateKey(new Date(ms)));
    }
  }
  return keys;
}

/** Real working days in [start, end] for a given working week (default Mon–Fri), minus holidays. */
export async function standardWorkDaysInRange(
  start: Date,
  end: Date,
  workingDays?: number[],
): Promise<number> {
  const holidayKeys = await holidayKeysInRange(start, end);
  return computeStandardWorkDays(start, end, holidayKeys, workingDays);
}
