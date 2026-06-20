/// <reference types="jest" />
import { enumerateDays, isWeekend, mmddKey } from '@features/attendance/services/attendance-calc';

// Mock the Holiday model used by countWorkingDays so the test stays pure.
jest.mock('@shared/models/holiday.model', () => ({
  Holiday: { find: jest.fn() },
}));

import { Holiday } from '@shared/models/holiday.model';
import { countWorkingDays } from '@features/attendance/services/leave.service';

const utc = (s: string) => new Date(`${s}T00:00:00.000Z`);

function mockHolidays(rows: Array<{ date: Date; isRecurring?: boolean }>) {
  (Holiday.find as jest.Mock).mockReturnValue({
    lean: () => Promise.resolve(rows.map((r) => ({ date: r.date, isRecurring: !!r.isRecurring }))),
  });
}

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
  beforeEach(() => jest.clearAllMocks());

  it('half-day returns 0.5', async () => {
    mockHolidays([]);
    expect(await countWorkingDays(utc('2026-06-22'), utc('2026-06-22'), 'morning')).toBe(0.5);
  });

  it('excludes weekends (Fri→Mon = 2 working days)', async () => {
    mockHolidays([]);
    // 2026-06-19 Fri, 20 Sat, 21 Sun, 22 Mon → Fri + Mon = 2
    expect(await countWorkingDays(utc('2026-06-19'), utc('2026-06-22'))).toBe(2);
  });

  it('excludes a fixed holiday in range', async () => {
    mockHolidays([{ date: utc('2026-06-23') }]);
    // Mon 22, Tue 23 (holiday), Wed 24 → 2 working days
    expect(await countWorkingDays(utc('2026-06-22'), utc('2026-06-24'))).toBe(2);
  });

  it('excludes a recurring holiday matched by MM-DD', async () => {
    mockHolidays([{ date: utc('2000-06-23'), isRecurring: true }]);
    expect(await countWorkingDays(utc('2026-06-22'), utc('2026-06-24'))).toBe(2);
  });
});
