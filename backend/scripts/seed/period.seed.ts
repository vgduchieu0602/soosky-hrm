/**
 * Payroll periods for the four-month demo window, plus the reset that makes the
 * whole seed re-runnable.
 *
 * Why the reset exists: the seed drives real lifecycle use-cases, which end with
 * periods `closed` / `paid` and payroll rows `approved` / `paid`. Those states
 * deliberately refuse to be recomputed (`PAY_PERIOD_LOCKED`,
 * `PAY_ALREADY_FINALIZED`), so a second `pnpm seed:demo` would abort halfway.
 * Rewinding the derived data first is what keeps the script idempotent.
 */
import type mongoose from 'mongoose';
import { PayrollPeriod } from '@modules/hrm';
import { Payroll } from '@modules/hrm/adapters/persistence/mongoose/models/payroll.model';
import { MonthlyEvaluation } from '@modules/hrm/adapters/persistence/mongoose/models/monthly-evaluation.model';
import { standardWorkDaysInRange } from '@modules/hrm/adapters/persistence/mongoose/payroll/workdays';
import { monthAnchor, utcDay, line } from './common';

type Id = mongoose.Types.ObjectId;

/** -3 = three months back … 0 = the current month. */
export const PERIOD_OFFSETS = [-3, -2, -1, 0] as const;

export interface SeededPeriod {
  id: Id;
  name: string;
  offset: number;
  year: number;
  month: number;
  start: Date;
  end: Date;
  standardWorkDays: number;
}

export async function seedPeriods(): Promise<SeededPeriod[]> {
  const periods: SeededPeriod[] = [];

  for (const offset of PERIOD_OFFSETS) {
    const anchor = monthAnchor(offset);
    // Payday is the 5th of the following month.
    const payDate = utcDay(anchor.year, anchor.month, 1);
    payDate.setUTCMonth(payDate.getUTCMonth() + 1);
    payDate.setUTCDate(5);

    const standardWorkDays = await standardWorkDaysInRange(anchor.start, anchor.end);

    const doc = await PayrollPeriod.findOneAndUpdate(
      { name: anchor.name },
      {
        $set: {
          startDate: anchor.start,
          endDate: anchor.end,
          payDate,
          standardWorkDays,
          // Every period starts back at `open` with its locks cleared; the
          // payroll step walks them forward to their final state.
          status: 'open',
          attendanceLockedAt: null,
          attendanceLockedBy: null,
          performanceLockedAt: null,
          performanceLockedBy: null,
          closedAt: null,
          closedBy: null,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    periods.push({
      id: doc!._id as Id,
      name: anchor.name,
      offset,
      year: anchor.year,
      month: anchor.month,
      start: anchor.start,
      end: anchor.end,
      standardWorkDays,
    });
  }

  const ids = periods.map((p) => p.id);
  const { deletedCount: payrolls } = await Payroll.deleteMany({ payrollPeriodId: { $in: ids } });
  const { deletedCount: evaluations } = await MonthlyEvaluation.deleteMany({ payrollPeriodId: { $in: ids } });

  line('Periods', periods.map((p) => `${p.name} (${p.standardWorkDays}d)`).join(', '));
  line('Reset for re-run', `${payrolls ?? 0} payrolls, ${evaluations ?? 0} evaluations removed`);
  return periods;
}
