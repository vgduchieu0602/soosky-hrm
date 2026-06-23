/// <reference types="jest" />
import { computeStandardWorkDays, dateKey } from '@shared/utils/workdays.util';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('computeStandardWorkDays', () => {
  it('counts only weekdays in the range (excludes Sat/Sun)', () => {
    // 2026-06-01 (Mon) .. 2026-06-30 (Tue): June 2026 has 22 weekdays.
    expect(computeStandardWorkDays(d('2026-06-01'), d('2026-06-30'))).toBe(22);
  });

  it('excludes public holidays that fall on a weekday', () => {
    // Drop two weekday holidays → 20.
    const holidays = new Set([dateKey(d('2026-06-01')), dateKey(d('2026-06-02'))]);
    expect(computeStandardWorkDays(d('2026-06-01'), d('2026-06-30'), holidays)).toBe(20);
  });

  it('ignores a holiday that lands on a weekend (no double-subtract)', () => {
    // 2026-06-06 is a Saturday — already excluded as a weekend.
    const holidays = new Set([dateKey(d('2026-06-06'))]);
    expect(computeStandardWorkDays(d('2026-06-01'), d('2026-06-30'), holidays)).toBe(22);
  });

  it('supports a custom working week (e.g. Mon–Sat)', () => {
    // One full week Mon..Sun with Mon–Sat working = 6.
    expect(computeStandardWorkDays(d('2026-06-01'), d('2026-06-07'), new Set(), [1, 2, 3, 4, 5, 6])).toBe(6);
  });
});
