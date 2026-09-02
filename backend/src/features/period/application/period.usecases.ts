import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import type {
  PeriodRepository,
  EmployeeGateway,
  EvaluationGateway,
  AttendanceGateway,
  WorkCalendarGateway,
  PayrollReadinessPort,
  AuditPort,
  EventsPort,
  Id,
} from '../domain/ports';
import type { CreatePeriodDto, UpdatePeriodDto } from '@shared/dto/period.dto';

const log = logger.child({ feature: 'period', module: 'period' });

export class PeriodUseCases {
  constructor(
    private readonly periods: PeriodRepository,
    private readonly employees: EmployeeGateway,
    private readonly evaluations: EvaluationGateway,
    private readonly attendance: AttendanceGateway,
    private readonly workCalendar: WorkCalendarGateway,
    private readonly payrollReadiness: PayrollReadinessPort,
    private readonly audit: AuditPort,
    private readonly events: EventsPort,
  ) {}

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
      standardWorkDays = await this.workCalendar.standardWorkDaysInRange(
        input.startDate,
        input.endDate,
      );
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

  /**
   * Close the period: no more payroll runs / edits. Implemented here (in the
   * period feature) rather than in payroll so the lock lives with the period it
   * governs. We still ask payroll, via `PayrollReadinessPort`, whether draft
   * rows remain — that is the single inbound dependency from payroll.
   */
  async close(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') {
      throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
    }
    const draftRemaining = await this.payrollReadiness.countDrafts(id);
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
    // Let payroll finalize its own computed rows for this period.
    this.events.periodClosed({ periodId: id, periodName: updated!.name });
    return updated!;
  }

  /** Pre-lock readiness: how complete is the period's attendance? */
  async attendanceReadiness(id: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');

    const activeEmployees = await this.employees.listForRun(period.startDate, period.endDate);
    const rows = await this.attendance.listStatusesInRange(period.startDate, period.endDate);

    const withRecords = new Set(rows.map((r) => String(r.employeeId)));
    const incompleteRows = rows.filter((r) => r.status === 'incomplete');
    const employeesNoRecords = activeEmployees.filter((e) => !withRecords.has(String(e._id))).length;

    const blockers = [
      ...(employeesNoRecords > 0
        ? [{ code: 'ATTENDANCE_EMPLOYEES_MISSING', count: employeesNoRecords }]
        : []),
      ...(incompleteRows.length > 0
        ? [{ code: 'ATTENDANCE_INCOMPLETE_RECORDS', count: incompleteRows.length }]
        : []),
    ];
    return {
      attendanceLocked: !!period.attendanceLockedAt,
      ready: blockers.length === 0,
      totalActiveEmployees: activeEmployees.length,
      employeesNoRecords,
      incompleteRecords: incompleteRows.length,
      employeesWithIncomplete: new Set(incompleteRows.map((r) => String(r.employeeId))).size,
      blockers,
    };
  }

  /** Lock attendance for the period so records can't change before payroll runs. */
  async lockAttendance(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
    const readiness = await this.attendanceReadiness(id);
    if (!readiness.ready) {
      throw new HttpError(409, 'Chấm công chưa sẵn sàng để chốt', 'PAY_ATTENDANCE_NOT_READY');
    }
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
    return updated!;
  }

  async performanceReadiness(id: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    const employees = await this.employees.listForRun(period.startDate, period.endDate);
    const finalized = new Set(await this.evaluations.finalizedEmployeeIds(id));
    const pending = employees.filter((employee) => !finalized.has(String(employee._id)));
    return {
      performanceLocked: !!period.performanceLockedAt,
      ready: pending.length === 0,
      totalEmployees: employees.length,
      finalized: employees.length - pending.length,
      pending: pending.length,
      blockers: pending.map((employee) => ({ employeeId: String(employee._id), code: 'PAY_EVAL_REQUIRED' })),
    };
  }

  async lockPerformance(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    await this.assertSourcesEditable(period);
    const readiness = await this.performanceReadiness(id);
    if (!readiness.ready) throw new HttpError(409, 'Đánh giá chưa sẵn sàng để chốt', 'PAY_PERFORMANCE_NOT_READY');
    const updated = await this.periods.lockPerformance(id, auditUserId);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { performanceLocked: true },
    });
    return updated!;
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
    if (period.status === 'paid') {
      throw new HttpError(
        409,
        'Kỳ lương đã thanh toán — không thể mở lại. Hãy hoàn tác thanh toán trước.',
        'PAY_PERIOD_PAID',
      );
    }
    const revertedRows = await this.payrollReadiness.countByPeriod(id);
    const updated = period.status === 'open' ? period : await this.periods.reopenToOpen(id);
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
    const count = await this.payrollReadiness.countByPeriod(id);
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

  private async assertSourcesEditable(period: Awaited<ReturnType<PeriodRepository['findById']>>) {
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
  }

  /** Re-open attendance for editing only after invalidating calculated payroll. */
  async unlockAttendance(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    await this.assertSourcesEditable(period);
    const updated = await this.periods.unlockAttendance(id);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { attendanceLocked: false },
    });
    log.info({ action: 'unlock-attendance', periodId: id });
    return updated!;
  }

  async unlockPerformance(id: Id, auditUserId: Id) {
    const period = await this.periods.findById(id);
    await this.assertSourcesEditable(period);
    const updated = await this.periods.unlockPerformance(id);
    await this.audit.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { performanceLocked: false },
    });
    return updated!;
  }
}
