import { enumerateDays, isWeekend, mmddKey } from '@features/attendance/domain/attendance-calc';
import { countWorkingDays, buildHolidayChecker } from '@features/attendance/domain/leave-policy';

const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

// Pure domain now: no Mongoose mocking — build the holiday predicate directly.
const checker = (rows: Array<{ date: Date; isRecurring?: boolean }> = []) => buildHolidayChecker(rows);

describe('attendance-calc date helpers', () => {
  it('enumerateDays is inclusive', () => {
    const days = enumerateDays(utc('2026-06-15'), utc('2026-06-17'));
    expect(days.map((d) => d.getUTCDate())).toEqual([15, 16, 17]);
  });

  it('isWeekend detects Sat/Sun', () => {
    expect(isWeekend(utc('2026-06-20'))).toBe(true); // Saturday
    expect(isWeekend(utc('2026-06-21'))).toBe(true); // Sunday
    expect(isWeekend(utc('2026-06-22'))).toBe(false); // Monday
  });

  it('mmddKey formats MM-DD', () => {
    expect(mmddKey(utc('2026-01-09'))).toBe('01-09');
  });
});

describe('countWorkingDays', () => {
  it('half-day returns 0.5', () => {
    expect(countWorkingDays(utc('2026-06-22'), utc('2026-06-22'), 'morning', checker())).toBe(0.5);
  });

  it('excludes weekends (Fri→Mon = 2 working days)', () => {
    // 2026-06-19 Fri, 20 Sat, 21 Sun, 22 Mon → Fri + Mon = 2
    expect(countWorkingDays(utc('2026-06-19'), utc('2026-06-22'), null, checker())).toBe(2);
  });

  it('excludes a fixed holiday in range', () => {
    const isHoliday = checker([{ date: utc('2026-06-23') }]);
    // Mon 22, Tue 23 (holiday), Wed 24 → 2 working days
    expect(countWorkingDays(utc('2026-06-22'), utc('2026-06-24'), null, isHoliday)).toBe(2);
  });

  it('excludes a recurring holiday matched by MM-DD', () => {
    const isHoliday = checker([{ date: utc('2000-06-23'), isRecurring: true }]);
    expect(countWorkingDays(utc('2026-06-22'), utc('2026-06-24'), null, isHoliday)).toBe(2);
  });
});
