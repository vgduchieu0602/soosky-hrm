/**
 * Payroll, produced by the real engine.
 *
 * `runPayrollForPeriod` resolves contracts into segments, aggregates attendance,
 * reads the finalized evaluation, applies the salary policy, insurance and tax,
 * and stores a full `calculationSnapshot`. A payroll row invented by the seed
 * would carry a plausible net and nothing else — no snapshot, no insurance, no
 * tax, so every payslip screen would render blank.
 *
 * The lifecycle is walked forward so the demo has one period in each state:
 *
 *   M-3  lock → run → approve → markPaid   → period `paid`,   rows `paid`
 *   M-2  lock → run → approve → close      → period `closed`, rows `approved`
 *   M-1  lock → run                        → period `open`,   rows `draft`
 *   M    left untouched                    → period `open`,   attendance editable
 *
 * M is deliberately left unlocked: locking it would freeze the current month's
 * attendance, which is the one thing you want to be able to edit while testing.
 */
import { periodUseCases, runPayrollForPeriod, approvePayroll, markPeriodPaid } from '@modules/hrm';
import { Payroll } from '@modules/hrm/adapters/persistence/mongoose/models/payroll.model';
import { userRepository } from '@modules/iam';
import { line } from './common';
import type { SeededPeriod } from './period.seed';

export interface PayrollSeedResult {
  computed: number;
  byStatus: Record<string, number>;
  errors: string[];
}

export async function seedPayroll(periods: SeededPeriod[]): Promise<PayrollSeedResult> {
  const result: PayrollSeedResult = { computed: 0, byStatus: {}, errors: [] };

  const admin = await userRepository.findByIdentifier('admin@soosky.local');
  if (!admin) throw new Error('admin@soosky.local not found — run `pnpm seed` before `pnpm seed:demo`.');
  const adminUserId = admin.id;

  const closed = periods.filter((p) => p.offset < 0).sort((a, b) => a.offset - b.offset);

  for (const period of closed) {
    const id = String(period.id);
    try {
      await periodUseCases.lockAttendance(id, adminUserId);
      await periodUseCases.lockPerformance(id, adminUserId);
    } catch (err) {
      result.errors.push(`${period.name} lock: ${(err as Error).message}`);
      continue;
    }

    // Per-employee failures are collected by the engine rather than aborting the
    // run, so they have to be surfaced here or they vanish.
    const run = await runPayrollForPeriod(id);
    result.computed += run.computed;
    for (const e of run.errors) result.errors.push(`${period.name} ${e.employeeId}: ${e.reason}`);
    line(`${period.name} computed`, `${run.computed} payrolls${run.errors.length ? `, ${run.errors.length} failed` : ''}`);

    if (period.offset === -1) continue; // stays draft on purpose

    try {
      await approvePayroll(id, adminUserId);
      if (period.offset === -3) {
        await markPeriodPaid(id, adminUserId);
      } else {
        await periodUseCases.close(id, adminUserId);
      }
    } catch (err) {
      result.errors.push(`${period.name} lifecycle: ${(err as Error).message}`);
    }
  }

  const rows = await Payroll.find({ payrollPeriodId: { $in: periods.map((p) => p.id) } }).select('status').lean();
  for (const row of rows) result.byStatus[row.status] = (result.byStatus[row.status] ?? 0) + 1;

  line('Payroll rows', `${rows.length} (${Object.entries(result.byStatus).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  for (const e of result.errors) console.warn(`  WARN payroll — ${e}`);
  return result;
}
