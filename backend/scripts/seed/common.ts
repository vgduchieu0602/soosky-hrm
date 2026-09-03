/**
 * Shared helpers for the demo seed.
 *
 * Deliberately small: date arithmetic, a deterministic PRNG and an environment
 * guard. No base classes, no registry — each `*.seed.ts` file is a plain async
 * function that takes what it needs and returns what the next step needs.
 */
import mongoose from 'mongoose';

export const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(Math.round(n)));

/** UTC date-key (00:00 UTC) — the shape attendance/period dates are stored in. */
export const utcDay = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

/** VN wall-clock HH:mm on a calendar day → the UTC instant it maps to (VN = UTC+7). */
export const vnInstant = (y: number, m: number, d: number, hh: number, mm = 0) =>
  new Date(Date.UTC(y, m - 1, d, hh - 7, mm));

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export interface MonthAnchor {
  /** `YYYY-MM` — also the PayrollPeriod name (unique key). */
  name: string;
  year: number;
  month: number;
  start: Date;
  end: Date;
  payDate: Date;
}

/**
 * A calendar month relative to today: `0` = this month, `-1` = last month.
 *
 * Anchoring on the real clock instead of a hard-coded year is what keeps the
 * dashboard's "today" / "this month" widgets populated — a fixed SEED_YEAR goes
 * stale the moment the calendar moves past it.
 */
export function monthAnchor(offset: number, now: Date = new Date()): MonthAnchor {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth() + 1;
  return {
    name: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
    start: first,
    end: utcDay(year, month, daysInMonth(year, month)),
    payDate: utcDay(year, month, daysInMonth(year, month)), // refined by caller if needed
  };
}

/**
 * Deterministic linear-congruential PRNG. Seeded per-caller so the dataset is
 * byte-identical across runs — a demo database that changes shape every seed is
 * useless for reproducing a bug.
 */
export function makeRng(seed: number) {
  let s = seed >>> 0;
  const next = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(a: readonly T[]): T => a[Math.floor(next() * a.length)]!,
    /** true with probability `p`. */
    chance: (p: number) => next() < p,
  };
}

/**
 * Demo data is destructive to business state (it rewrites attendance, payroll
 * and evaluations for the seeded employees), so it must never touch production.
 */
export function assertNotProduction(script: string): void {
  if (process.env.NODE_ENV === 'production') {
    console.error(`${script} refuses to run with NODE_ENV=production.`);
    process.exit(1);
  }
}

export function section(title: string): void {
  console.log(`\n${title}`);
}

export function line(label: string, value: string | number): void {
  console.log(`  ${label}: ${value}`);
}
