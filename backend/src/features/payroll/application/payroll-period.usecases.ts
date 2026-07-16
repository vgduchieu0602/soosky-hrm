import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import type {
  PayrollPeriodRepository,
  PayrollRepository,
  EmployeeGateway,
  AttendanceGateway,
  WorkCalendarGateway,
  EvaluationGateway,
  PayrollRunPort,
  AuditPort,
  EventsPort,
  Id,
  PeriodRecord,
} from '@features/payroll/domain/ports';
import type { CreatePeriodDto, UpdatePeriodDto } from '@features/payroll/dto/payroll-period.dto';

const log = logger.child({ feature: 'payroll', module: 'period' });

export class PayrollPeriodUseCases {
  constructor(
    private readonly periods: PayrollPeriodRepository,
    private readonly payrolls: PayrollRepository,
    private readonly employees: EmployeeGateway,
    private readonly attendance: AttendanceGateway,
    private readonly workCalendar: WorkCalendarGateway,
    private readonly evaluations: EvaluationGateway,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
    /** Late-bound: the run engine is constructed after this use-case. */
    private readonly runner: () => PayrollRunPort,
  ) {}

  /**
   * When both locks are in place, kick off the payroll computation for the whole
   * period IN THE BACKGROUND and return immediately — a large company can take
   * far longer than any HTTP timeout. The lock has already persisted; compute is
   * best-effort and never blocks (or fails) the lock response. Returns whether a
   * background run was triggered so the UI can tell HR to check back shortly.
   */
  private autoRunIfFullyLocked(period: PeriodRecord | null): boolean {
    if (!period?.attendanceLockedAt || !period.evaluationLockedAt) return false;
    const periodId = String(period._id);
    setImmediate(() => {
      this.runner()
        .forPeriod(periodId)
        .then((run) =>
          log.info({ action: 'auto-run-on-lock', periodId, computed: run.computed, failed: run.errors.length }),
        )
        .catch((err) =>
          log.error({ action: 'auto-run-on-lock-failed', periodId, err: (err as Error).message }),
        );
    });
    return true;
  }

  list() {
    return this.periods.list();
  }

  async get(id: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    return period;
  }

  async create(input: CreatePeriodDto, auditUserId: Id) {
    const dup = await this.periods.findByName(input.name);
    if (dup) throw new HttpError(409, `Kỳ lương ${input.name} đã tồn tại`, 'PAY_PERIOD_DUP');

    // Default the standard work days to the REAL working days in the period
    // (exclude weekends + public holidays) instead of a flat company number, so
    // a month with holidays doesn't unfairly drag every employee's 20% ratio.
    let standardWorkDays = input.standardWorkDays;
    if (standardWorkDays == null) {
      standardWorkDays = await this.workCalendar.standardWorkDaysInRange(input.startDate, input.endDate);
      if (standardWorkDays <= 0) {
        standardWorkDays = (await this.workCalendar.companyStandardWorkDays()) ?? 22;
      }
    }

    const created = await this.periods.create({ ...input, standardWorkDays });
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'create',
      resourceId: String(created._id),
      changes: { name: input.name },
    });
    log.info({ action: 'create', name: input.name });
    return created;
  }

  async update(id: Id, input: UpdatePeriodDto, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'closed' || period.status === 'paid') {
      throw new HttpError(409, `Kỳ lương đã ${period.status}, không thể sửa`, 'PAY_PERIOD_LOCKED');
    }
    const updated = await this.periods.update(id, input);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated!;
  }

  /** Lock the period: no more payroll runs / edits. */
  async close(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') {
      throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
    }
    // Refuse to close while draft rows remain: a closed period can't be run
    // (assertPeriodOpen) and can't be paid (PAY_DRAFT_REMAINING), so closing
    // with drafts strands the period until someone reopens it.
    const draftRemaining = await this.payrolls.countDrafts(id);
    if (draftRemaining > 0) {
      throw new HttpError(
        409,
        `Còn ${draftRemaining} bản lương chưa duyệt — duyệt hoặc hoàn tác hết trước khi chốt kỳ`,
        'PAY_DRAFT_REMAINING',
      );
    }
    const updated = await this.periods.markClosed(id, auditUserId);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { status: 'closed' },
    });
    log.info({ action: 'close', periodId: id });
    return updated!;
  }

  /**
   * Pre-lock readiness: how complete is the period's attendance? Surfaces active
   * employees with no record yet and records still missing a check-out, so HR
   * only locks once attendance is actually finished.
   */
  async attendanceReadiness(id: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');

    const activeEmployees = await this.employees.listNonTerminatedIds();
    const rows = await this.attendance.listStatusesInRange(period.startDate, period.endDate);

    const withRecords = new Set(rows.map((r) => String(r.employeeId)));
    const incompleteRows = rows.filter((r) => r.status === 'incomplete');
    const employeesNoRecords = activeEmployees.filter((e) => !withRecords.has(String(e._id))).length;

    return {
      attendanceLocked: !!period.attendanceLockedAt,
      totalActiveEmployees: activeEmployees.length,
      employeesNoRecords,
      incompleteRecords: incompleteRows.length,
      employeesWithIncomplete: new Set(incompleteRows.map((r) => String(r.employeeId))).size,
    };
  }

  /** Lock attendance for the period so records can't change before payroll runs. */
  async lockAttendance(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
    const updated = await this.periods.lockAttendance(id, auditUserId);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { attendanceLocked: true },
    });
    log.info({ action: 'lock-attendance', periodId: id });
    this.events.attendanceLocked({ periodId: id, periodName: updated!.name });
    const autoRunning = this.autoRunIfFullyLocked(updated);
    return { period: updated!, autoRunning };
  }

  /**
   * Re-open a closed period so it can be recomputed (correction). Admin.
   * Reverts every `approved` row back to `draft` so the period is actually
   * runnable again — otherwise `runPayrollForEmployee` rejects non-draft rows
   * and the reopen is a no-op. A `paid` period is refused: money has been
   * disbursed, so payments must be reverted through a dedicated flow first.
   */
  async reopen(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'open') return period;
    if (period.status === 'paid') {
      throw new HttpError(
        409,
        'Kỳ lương đã thanh toán — không thể mở lại. Hãy hoàn tác thanh toán trước.',
        'PAY_PERIOD_PAID',
      );
    }

    const revertedRows = await this.payrolls.reopenApprovedToDraft(id);
    const updated = await this.periods.reopenToOpen(id);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { reopened: true, from: period.status, revertedRows },
    });
    log.info({ action: 'reopen', periodId: id, revertedRows });
    return updated!;
  }

  /** Delete a period created by mistake — only when it has no payroll rows yet. */
  async remove(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    const count = await this.payrolls.countByPeriod(id);
    if (count > 0) {
      throw new HttpError(409, 'Kỳ đã có bảng lương — không thể xoá. Hãy hoàn tác bảng lương trước.', 'PAY_PERIOD_HAS_DATA');
    }
    await this.periods.delete(id);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'delete',
      resourceId: id,
      changes: { name: period.name },
    });
    log.info({ action: 'delete', periodId: id });
    return { id };
  }

  /**
   * Pre-lock readiness for evaluations: how many active employees still lack a
   * finalized (approved/acknowledged) monthly evaluation for this period.
   */
  async evaluationReadiness(id: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');

    const activeEmployees = await this.employees.listNonTerminatedIds();
    const finalized = new Set(await this.evaluations.finalizedEmployeeIds(id));
    const employeesNoEvaluation = activeEmployees.filter((e) => !finalized.has(String(e._id))).length;

    return {
      evaluationLocked: !!period.evaluationLockedAt,
      totalActiveEmployees: activeEmployees.length,
      finalizedEvaluations: finalized.size,
      employeesNoEvaluation,
    };
  }

  /**
   * Lock the period's monthly evaluations: scores are frozen (no more
   * directEvaluate/reopen for this period) and payroll may consume them.
   * Mirrors lockAttendance.
   */
  async lockEvaluations(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
    const updated = await this.periods.lockEvaluations(id, auditUserId);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { evaluationLocked: true },
    });
    log.info({ action: 'lock-evaluations', periodId: id });
    const autoRunning = this.autoRunIfFullyLocked(updated);
    return { period: updated!, autoRunning };
  }

  /** Re-open evaluations for editing (only before the period is closed/paid). */
  async unlockEvaluations(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'closed' || period.status === 'paid') {
      throw new HttpError(409, `Kỳ lương đã ${period.status}, không thể mở chốt đánh giá`, 'PAY_PERIOD_LOCKED');
    }
    const updated = await this.periods.unlockEvaluations(id);
    // Unlocking means inputs will change → any already-approved (not paid)
    // payslip must go back to draft so re-locking recomputes it with the new
    // data. Paid rows are money-out and stay untouched.
    const reverted = await this.payrolls.reopenApprovedToDraft(id);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { evaluationLocked: false, revertedPayrolls: reverted },
    });
    log.info({ action: 'unlock-evaluations', periodId: id, revertedPayrolls: reverted });
    return updated!;
  }

  /** Re-open attendance for editing (only before the period is closed/paid). */
  async unlockAttendance(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'closed' || period.status === 'paid') {
      throw new HttpError(409, `Kỳ lương đã ${period.status}, không thể mở chốt`, 'PAY_PERIOD_LOCKED');
    }
    const updated = await this.periods.unlockAttendance(id);
    // Same as unlockEvaluations: revert approved (not paid) payslips to draft so
    // a subsequent re-lock recomputes them with the corrected attendance/salary.
    const reverted = await this.payrolls.reopenApprovedToDraft(id);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { attendanceLocked: false, revertedPayrolls: reverted },
    });
    log.info({ action: 'unlock-attendance', periodId: id, revertedPayrolls: reverted });
    return updated!;
  }
}
