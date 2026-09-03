/**
 * Leave balances and leave requests.
 *
 * Approved requests go through `leaveUseCases.approve` rather than being written
 * straight to the collection: that use-case is what deducts the balance and
 * writes the matching `leave_paid` / `leave_unpaid` attendance rows. Hand-writing
 * the request would leave attendance and the balance silently inconsistent with
 * it, and payroll reads attendance.
 *
 * Runs BEFORE the periods are locked — approving leave into a locked period is
 * refused by design.
 */
import { leaveUseCases } from '@modules/hrm';
import { LeaveBalance } from '@modules/hrm/adapters/persistence/mongoose/models/leave-balance.model';
import { LeaveRequest, type LeaveType } from '@modules/hrm/adapters/persistence/mongoose/models/leave-request.model';
import { Attendance } from '@modules/hrm/adapters/persistence/mongoose/models/attendance.model';
import { holidayKeysInRange } from '@modules/hrm/adapters/persistence/mongoose/payroll/workdays';
import { dateKey } from '@modules/hrm/core/payroll/domain/workdays.util';
import { countWorkingDays } from '@modules/hrm/core/attendance/domain/leave-policy';
import { userRepository } from '@modules/iam';
import { LEAVE_REQUESTS } from './dataset';
import { monthAnchor, utcDay, line } from './common';
import type { SeededEmployee } from './employee.seed';
import type { SeededPeriod } from './period.seed';

export interface LeaveSeedResult {
  balances: number;
  approved: number;
  pending: number;
  rejected: number;
  cancelled: number;
  skipped: string[];
}

/**
 * Clear the derived state the seed owns for these employees, so a re-run starts
 * from a known-empty window instead of stacking a second set of records on top.
 *
 * `leave_paid` rows sit on `shiftId: null`, which the unique
 * `{employeeId, date, shiftId}` index skips (it is partial on an ObjectId
 * shiftId) — nothing at the database level would stop them duplicating.
 */
export async function resetAttendanceAndLeave(
  employees: SeededEmployee[],
  periods: SeededPeriod[],
): Promise<void> {
  const ids = employees.map((e) => e.id);
  const from = periods[0]!.start;
  const to = periods[periods.length - 1]!.end;

  const { deletedCount: att } = await Attendance.deleteMany({ employeeId: { $in: ids }, date: { $gte: from, $lte: to } });
  const { deletedCount: req } = await LeaveRequest.deleteMany({ employeeId: { $in: ids } });
  await LeaveBalance.updateMany({ employeeId: { $in: ids } }, { $set: { used: 0 } });

  line('Reset for re-run', `${att ?? 0} attendance rows, ${req ?? 0} leave requests removed`);
}

export async function seedLeave(
  employees: SeededEmployee[],
  periods: SeededPeriod[],
): Promise<LeaveSeedResult> {
  const byCode = new Map(employees.map((e) => [e.code, e]));
  const result: LeaveSeedResult = { balances: 0, approved: 0, pending: 0, rejected: 0, cancelled: 0, skipped: [] };

  const hr = await userRepository.findByIdentifier('hr@soosky.local');
  if (!hr) throw new Error('hr@soosky.local not found — run `pnpm seed` before `pnpm seed:demo`.');
  const approverId = hr.id;

  // --- Balances: this year and last year, so the 3-year carry-over pool has
  // something to pool. Annual leave is an official-employee entitlement only,
  // which is the same rule LeaveEntitlementService enforces.
  const thisYear = periods[periods.length - 1]!.end.getUTCFullYear();
  for (const employee of employees) {
    for (const year of [thisYear - 1, thisYear]) {
      const quotas: [LeaveType, number][] = [
        ['annual', employee.isOfficial ? 12 : 0],
        ['sick', 30],
        ['personal', 3],
      ];
      for (const [leaveType, entitled] of quotas) {
        if (entitled === 0) continue;
        await LeaveBalance.updateOne(
          { employeeId: employee.id, leaveType, year },
          { $set: { entitled }, $setOnInsert: { used: 0 } },
          { upsert: true },
        );
        result.balances += 1;
      }
    }
  }
  line('Leave balances', result.balances);

  // --- Requests
  for (const spec of LEAVE_REQUESTS) {
    const employee = byCode.get(spec.employee);
    if (!employee) continue;
    const anchor = monthAnchor(spec.offset);
    const startDate = utcDay(anchor.year, anchor.month, spec.startDay);
    const endDate = utcDay(anchor.year, anchor.month, spec.endDay);

    // `days` must match what the domain would have counted, otherwise the
    // balance deduction and the generated attendance rows disagree.
    const holidayKeys = await holidayKeysInRange(startDate, endDate);
    const isHoliday = (d: Date) => holidayKeys.has(dateKey(d));
    const days = countWorkingDays(startDate, endDate, spec.halfDaySession ?? null, isHoliday);
    if (days <= 0) {
      result.skipped.push(`${spec.employee} ${anchor.name} (khoảng nghỉ không có ngày làm việc)`);
      continue;
    }

    const created = await LeaveRequest.create({
      employeeId: employee.id,
      leaveType: spec.leaveType,
      startDate,
      endDate,
      days,
      halfDaySession: spec.halfDaySession ?? null,
      reason: spec.reason,
      status: 'pending',
    });

    if (spec.status === 'pending') {
      result.pending += 1;
      continue;
    }
    if (spec.status === 'cancelled') {
      await LeaveRequest.updateOne({ _id: created._id }, { $set: { status: 'cancelled' } });
      result.cancelled += 1;
      continue;
    }
    if (spec.status === 'rejected') {
      await LeaveRequest.updateOne(
        { _id: created._id },
        { $set: { status: 'rejected', approverId, approvedAt: new Date(), rejectionReason: spec.reason } },
      );
      result.rejected += 1;
      continue;
    }

    try {
      await leaveUseCases.approve(String(created._id), approverId);
      result.approved += 1;
    } catch (err) {
      // A quota rejection is a legitimate business outcome, not a seed crash —
      // record it and leave the request pending so it stays visible in the UI.
      result.skipped.push(`${spec.employee} ${anchor.name} ${spec.leaveType}: ${(err as Error).message}`);
    }
  }

  line('Leave requests', `${result.approved} approved, ${result.pending} pending, ${result.rejected} rejected, ${result.cancelled} cancelled`);
  if (result.skipped.length > 0) {
    for (const s of result.skipped) console.warn(`  WARN leave skipped — ${s}`);
  }
  return result;
}
