/**
 * Payroll lifecycle workflow: draft → approved → paid.
 *
 *   approve   (HR/Admin) : draft     → approved   (stamps approvedBy)
 *   revert    (HR/Admin) : approved  → draft       (re-open for recompute)
 *   markPaid  (Admin)    : approved  → paid         (stamps paidAt; locks period)
 *
 * Each transition is transactional and audited; `payroll.approved` /
 * `payroll.paid` events fan out to notification listeners.
 */
import mongoose from 'mongoose';

import { logger } from '@core/logger/logger';
import { eventBus } from '@core/events/event-bus';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { Payroll } from '@shared/models/payroll.model';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
import { auditService } from '@features/iam/services/audit.service';

const log = logger.child({ feature: 'payroll', module: 'approval' });

const conflict = (message: string, code = 'PAY_409') => new HttpError(409, message, code);

export interface ApprovalResult {
  periodId: string;
  affected: number;
}

async function loadPeriod(periodId: string) {
  const period = await PayrollPeriod.findById(periodId);
  if (!period) throw new NotFoundError('Payroll period');
  return period;
}

/**
 * Approve payroll rows in a period. Approves every `draft` row, or a single
 * employee when `employeeId` is given. Refuses if the period is already paid.
 */
export async function approvePayroll(
  periodId: string,
  approverUserId: string,
  employeeId?: string,
): Promise<ApprovalResult> {
  const period = await loadPeriod(periodId);
  if (period.status === 'paid') throw conflict(`Kỳ ${period.name} đã thanh toán`, 'PAY_PERIOD_LOCKED');

  const filter: Record<string, unknown> = { payrollPeriodId: periodId, status: 'draft' };
  if (employeeId) filter.employeeId = employeeId;

  const draftCount = await Payroll.countDocuments(filter);
  if (draftCount === 0) throw conflict('Không có bản lương draft để duyệt', 'PAY_NOTHING_TO_APPROVE');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Payroll.updateMany(
        filter,
        { $set: { status: 'approved', approvedBy: new mongoose.Types.ObjectId(approverUserId) } },
        { session },
      );
      // Whole-period approval moves the period into 'processing'.
      if (!employeeId && period.status === 'open') {
        await PayrollPeriod.updateOne(
          { _id: periodId },
          { $set: { status: 'processing' } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  await auditService.record({
    userId: approverUserId,
    resource: 'payroll',
    action: 'update',
    resourceId: periodId,
    changes: { action: 'approve', count: draftCount, employeeId: employeeId ?? 'all' },
  });
  eventBus.emit('payroll.approved', { periodId, count: draftCount, approvedBy: approverUserId });
  log.info({ action: 'approve', periodId, count: draftCount });
  return { periodId, affected: draftCount };
}

/** Re-open an approved row back to draft so it can be recomputed. */
export async function revertPayrollToDraft(
  payrollId: string,
  userId: string,
): Promise<{ id: string }> {
  const payroll = await Payroll.findById(payrollId);
  if (!payroll) throw new NotFoundError('Payroll');
  if (payroll.status !== 'approved') {
    throw conflict(`Chỉ revert được bản đã duyệt (hiện: ${payroll.status})`, 'PAY_NOT_APPROVED');
  }
  payroll.status = 'draft';
  payroll.approvedBy = null;
  await payroll.save();

  await auditService.record({
    userId,
    resource: 'payroll',
    action: 'update',
    resourceId: payrollId,
    changes: { action: 'revert-to-draft' },
  });
  log.info({ action: 'revert', payrollId });
  return { id: payrollId };
}

/**
 * Mark every approved row in a period as paid and lock the period. Refuses if
 * any row is still draft (must be approved first).
 */
export async function markPeriodPaid(
  periodId: string,
  payerUserId: string,
): Promise<ApprovalResult> {
  const period = await loadPeriod(periodId);
  if (period.status === 'paid') throw conflict(`Kỳ ${period.name} đã thanh toán`, 'PAY_PERIOD_LOCKED');

  const draftRemaining = await Payroll.countDocuments({
    payrollPeriodId: periodId,
    status: 'draft',
  });
  if (draftRemaining > 0) {
    throw conflict(
      `Còn ${draftRemaining} bản lương chưa duyệt; duyệt hết trước khi thanh toán`,
      'PAY_DRAFT_REMAINING',
    );
  }

  const approvedCount = await Payroll.countDocuments({
    payrollPeriodId: periodId,
    status: 'approved',
  });
  if (approvedCount === 0) throw conflict('Không có bản lương đã duyệt để thanh toán', 'PAY_NOTHING_TO_PAY');

  const now = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Payroll.updateMany(
        { payrollPeriodId: periodId, status: 'approved' },
        { $set: { status: 'paid', paidAt: now } },
        { session },
      );
      await PayrollPeriod.updateOne(
        { _id: periodId },
        { $set: { status: 'paid' } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  await auditService.record({
    userId: payerUserId,
    resource: 'payroll',
    action: 'update',
    resourceId: periodId,
    changes: { action: 'mark-paid', count: approvedCount },
  });
  eventBus.emit('payroll.paid', { periodId, count: approvedCount, paidBy: payerUserId });
  log.info({ action: 'mark-paid', periodId, count: approvedCount });
  return { periodId, affected: approvedCount };
}
