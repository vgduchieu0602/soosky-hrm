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
import { logger } from '@infra/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import type {
  PayrollRepository,
  AuditPort,
  EventsPort,
  UnitOfWork,
  Id,
  Clock,
} from '@modules/hrm/core/payroll/domain/ports';
import type { PeriodReader, PeriodLifecycle } from '@modules/hrm/core/period/domain/ports';

const log = logger.child({ feature: 'payroll', module: 'approval' });

const conflict = (message: string, code = 'PAY_409') => new HttpError(409, message, code);

export interface ApprovalResult {
  periodId: string;
  affected: number;
}

export class PayrollApprovalUseCases {
  constructor(
    private readonly periodReader: PeriodReader,
  private readonly periodLifecycle: PeriodLifecycle,
    private readonly payrolls: PayrollRepository,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
    private readonly uow: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  private async loadPeriod(periodId: Id) {
    const period = await this.periodReader.findById(periodId);
    if (!period) throw new NotFoundError('Payroll period');
    return period;
  }

  /**
   * Approve payroll rows in a period. Approves every `draft` row, or a single
   * employee when `employeeId` is given. Refuses if the period is already paid.
   */
  async approve(periodId: Id, approverUserId: Id, employeeId?: Id): Promise<ApprovalResult> {
    const period = await this.loadPeriod(periodId);
    if (period.status === 'paid') throw conflict(`Kỳ ${period.name} đã thanh toán`, 'PAY_PERIOD_LOCKED');

    const draftCount = await this.payrolls.countDrafts(periodId, employeeId);
    if (draftCount === 0) throw conflict('Không có bản lương draft để duyệt', 'PAY_NOTHING_TO_APPROVE');

    await this.uow.withTransaction(async (tx) => {
      await this.payrolls.approveMany(periodId, employeeId, approverUserId, tx);
      // Whole-period approval moves the period into 'processing'.
      if (!employeeId && period.status === 'open') {
        await this.periodLifecycle.markProcessing(periodId, tx);
      }
    });

    await this.audit.record({
      userId: approverUserId,
      resource: 'payroll',
      action: 'update',
      resourceId: periodId,
      changes: { action: 'approve', count: draftCount, employeeId: employeeId ?? 'all' },
    });
    this.events.payrollApproved({ periodId, count: draftCount, approvedBy: approverUserId });
    log.info({ action: 'approve', periodId, count: draftCount });
    return { periodId, affected: draftCount };
  }

  /** Re-open an approved row back to draft so it can be recomputed. */
  async revert(payrollId: Id, userId: Id): Promise<{ id: string }> {
    const payroll = await this.payrolls.findStatusById(payrollId);
    if (!payroll) throw new NotFoundError('Payroll');
    if (payroll.status !== 'approved') {
      throw conflict(`Chỉ revert được bản đã duyệt (hiện: ${payroll.status})`, 'PAY_NOT_APPROVED');
    }
    await this.payrolls.revertToDraft(payrollId);

    await this.audit.record({
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
  async markPaid(periodId: Id, payerUserId: Id): Promise<ApprovalResult> {
    const period = await this.loadPeriod(periodId);
    if (period.status === 'paid') throw conflict(`Kỳ ${period.name} đã thanh toán`, 'PAY_PERIOD_LOCKED');

    const draftRemaining = await this.payrolls.countDrafts(periodId);
    if (draftRemaining > 0) {
      throw conflict(
        `Còn ${draftRemaining} bản lương chưa duyệt; duyệt hết trước khi thanh toán`,
        'PAY_DRAFT_REMAINING',
      );
    }

    const approvedCount = await this.payrolls.countApproved(periodId);
    if (approvedCount === 0) throw conflict('Không có bản lương đã duyệt để thanh toán', 'PAY_NOTHING_TO_PAY');

    const now = new Date();
    await this.uow.withTransaction(async (tx) => {
      await this.payrolls.markPaidMany(periodId, now, tx);
      await this.periodLifecycle.markPaid(periodId, tx);
    });

    await this.audit.record({
      userId: payerUserId,
      resource: 'payroll',
      action: 'update',
      resourceId: periodId,
      changes: { action: 'mark-paid', count: approvedCount },
    });
    this.events.payrollPaid({ periodId, count: approvedCount, paidBy: payerUserId });
    log.info({ action: 'mark-paid', periodId, count: approvedCount });
    return { periodId, affected: approvedCount };
  }
}
