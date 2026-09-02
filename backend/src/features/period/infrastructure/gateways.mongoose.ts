import mongoose from 'mongoose';
import { PayrollPeriod } from './period.schema';
import type { AttendanceLockPort, PerformanceLockPort, PeriodReader, PeriodLifecycle, Id, Tx } from '../domain/ports';
import { MongoosePeriodRepository } from './period.repository.mongoose';

/**
 * The edit-lock ports consumed by `attendance` and `performance`.
 *
 * Previously those two kept features read the `payrollPeriods` model directly,
 * so splitting payroll out would have orphaned their locks. Now the lock lives
 * with the period that owns it and is exposed as a port — attendance/performance
 * depend only on this interface, never on the model or on payroll.
 */

export class MongoosePeriodGateway implements AttendanceLockPort, PerformanceLockPort, PeriodReader, PeriodLifecycle {
  private readonly repo = new MongoosePeriodRepository();

  // ---- AttendanceLockPort ----

  async lockedPeriodName(date: Date): Promise<string | null> {
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const locked = await PayrollPeriod.findOne({
      startDate: { $lte: day },
      endDate: { $gte: day },
      attendanceLockedAt: { $ne: null },
    })
      .select('name')
      .lean();
    return locked?.name ?? null;
  }

  // ---- PerformanceLockPort ----

  async findLockedPayroll(payrollPeriodId: Id, employeeId: Id): Promise<{ status: string } | null> {
    if (!mongoose.Types.ObjectId.isValid(payrollPeriodId)) return null;
    const period = await PayrollPeriod.findById(payrollPeriodId).select('performanceLockedAt').lean();
    if (!period?.performanceLockedAt) return null;
    // The period's performance lock freezes evaluation inputs for the period.
    return { status: 'approved' };
  }

  async isPerformancePeriodLocked(payrollPeriodId: Id): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(payrollPeriodId)) return false;
    const period = await PayrollPeriod.findById(payrollPeriodId).select('performanceLockedAt').lean();
    return !!period?.performanceLockedAt;
  }

  // ---- PeriodReader (consumed by payroll) ----

  list() {
    return this.repo.list();
  }
  findById(id: Id) {
    return this.repo.findById(id);
  }
  findByName(name: string) {
    return this.repo.findByName(name);
  }
  findLatest() {
    return this.repo.findLatest();
  }
  namesByIds(ids: Id[]) {
    return this.repo.namesByIds(ids);
  }

  // ---- PeriodLifecycle (consumed by payroll) ----

  async markProcessing(periodId: Id, tx: Tx) {
    await this.repo.markProcessing(periodId, tx);
  }
  async markPaid(periodId: Id, tx: Tx) {
    await this.repo.markPaid(periodId, tx);
  }
}
