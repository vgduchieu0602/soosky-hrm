import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { eventBus } from '@core/events/event-bus';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { CompanyConfig } from '@shared/models/company-config.model';
import { Employee } from '@shared/models/employee.model';
import { Attendance } from '@shared/models/attendance.model';
import { Payroll } from '@shared/models/payroll.model';
import { auditService } from '@features/iam/services/audit.service';
import { payrollPeriodRepository } from '@features/payroll/repositories/payroll-period.repository';
import { standardWorkDaysInRange } from '@features/payroll/services/workdays.service';
import type {
  CreatePeriodDto,
  UpdatePeriodDto,
} from '@features/payroll/dto/payroll-period.dto';

declare module '@core/events/event-bus' {
  interface AppEventMap {
    'payroll.attendance-locked': { periodId: string; periodName: string };
  }
}

const log = logger.child({ feature: 'payroll', module: 'period' });

export const payrollPeriodService = {
  list() {
    return payrollPeriodRepository.list();
  },

  async get(id: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    return period.toJSON();
  },

  async create(input: CreatePeriodDto, auditUserId: string) {
    const dup = await payrollPeriodRepository.findByName(input.name);
    if (dup) throw new HttpError(409, `Kỳ lương ${input.name} đã tồn tại`, 'PAY_PERIOD_DUP');

    // Default the standard work days to the REAL working days in the period
    // (exclude weekends + public holidays) instead of a flat company number, so
    // a month with holidays doesn't unfairly drag every employee's 20% ratio.
    let standardWorkDays = input.standardWorkDays;
    if (standardWorkDays == null) {
      standardWorkDays = await standardWorkDaysInRange(input.startDate, input.endDate);
      if (standardWorkDays <= 0) {
        const config = await CompanyConfig.findOne({ key: 'global' }).lean();
        standardWorkDays = config?.standardWorkDays ?? 22;
      }
    }

    const created = await payrollPeriodRepository.create({ ...input, standardWorkDays, createdBy: null });
    await auditService.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'create',
      resourceId: created._id.toString(),
      changes: { name: input.name },
    });
    log.info({ action: 'create', name: input.name });
    return created.toJSON();
  },

  async update(id: string, input: UpdatePeriodDto, auditUserId: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'closed' || period.status === 'paid') {
      throw new HttpError(409, `Kỳ lương đã ${period.status}, không thể sửa`, 'PAY_PERIOD_LOCKED');
    }
    const updated = await payrollPeriodRepository.updateById(id, input);
    await auditService.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated!.toJSON();
  },

  /** Lock the period: no more payroll runs / edits. */
  async close(id: string, auditUserId: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') {
      throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
    }
    // Refuse to close while draft rows remain: a closed period can't be run
    // (assertPeriodOpen) and can't be paid (PAY_DRAFT_REMAINING), so closing
    // with drafts strands the period until someone reopens it.
    const draftRemaining = await Payroll.countDocuments({
      payrollPeriodId: id,
      status: 'draft',
    });
    if (draftRemaining > 0) {
      throw new HttpError(
        409,
        `Còn ${draftRemaining} bản lương chưa duyệt — duyệt hoặc hoàn tác hết trước khi chốt kỳ`,
        'PAY_DRAFT_REMAINING',
      );
    }
    const updated = await payrollPeriodRepository.updateById(id, {
      status: 'closed',
      closedAt: new Date(),
      closedBy: new Types.ObjectId(auditUserId),
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'payrollPeriod',
      action: 'update',
      resourceId: id,
      changes: { status: 'closed' },
    });
    log.info({ action: 'close', periodId: id });
    return updated!.toJSON();
  },

  /**
   * Pre-lock readiness: how complete is the period's attendance? Surfaces active
   * employees with no record yet and records still missing a check-out, so HR
   * only locks once attendance is actually finished.
   */
  async attendanceReadiness(id: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');

    const activeEmployees = await Employee.find({ status: { $ne: 'terminated' } })
      .select('_id')
      .lean();
    const rows = await Attendance.find({
      date: { $gte: period.startDate, $lte: period.endDate },
    })
      .select('employeeId status')
      .lean();

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
  },

  /** Lock attendance for the period so records can't change before payroll runs. */
  async lockAttendance(id: string, auditUserId: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'paid') throw new HttpError(409, 'Kỳ lương đã thanh toán', 'PAY_PERIOD_LOCKED');
    const updated = await payrollPeriodRepository.updateById(id, {
      attendanceLockedAt: new Date(),
      attendanceLockedBy: new Types.ObjectId(auditUserId),
    });
    await auditService.record({
      userId: auditUserId, resource: 'payrollPeriod', action: 'update', resourceId: id,
      changes: { attendanceLocked: true },
    });
    log.info({ action: 'lock-attendance', periodId: id });
    eventBus.emit('payroll.attendance-locked', { periodId: id, periodName: updated!.name });
    return updated!.toJSON();
  },

  /**
   * Re-open a closed period so it can be recomputed (correction). Admin.
   * Reverts every `approved` row back to `draft` so the period is actually
   * runnable again — otherwise `runPayrollForEmployee` rejects non-draft rows
   * and the reopen is a no-op. A `paid` period is refused: money has been
   * disbursed, so payments must be reverted through a dedicated flow first.
   */
  async reopen(id: string, auditUserId: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'open') return period.toJSON();
    if (period.status === 'paid') {
      throw new HttpError(
        409,
        'Kỳ lương đã thanh toán — không thể mở lại. Hãy hoàn tác thanh toán trước.',
        'PAY_PERIOD_PAID',
      );
    }

    const reverted = await Payroll.updateMany(
      { payrollPeriodId: id, status: 'approved' },
      { $set: { status: 'draft' }, $unset: { approvedBy: '' } },
    );
    const updated = await payrollPeriodRepository.updateById(id, {
      status: 'open',
      closedAt: null,
      closedBy: null,
    });
    await auditService.record({
      userId: auditUserId, resource: 'payrollPeriod', action: 'update', resourceId: id,
      changes: { reopened: true, from: period.status, revertedRows: reverted.modifiedCount },
    });
    log.info({ action: 'reopen', periodId: id, revertedRows: reverted.modifiedCount });
    return updated!.toJSON();
  },

  /** Delete a period created by mistake — only when it has no payroll rows yet. */
  async remove(id: string, auditUserId: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    const count = await Payroll.countDocuments({ payrollPeriodId: id });
    if (count > 0) {
      throw new HttpError(409, 'Kỳ đã có bảng lương — không thể xoá. Hãy hoàn tác bảng lương trước.', 'PAY_PERIOD_HAS_DATA');
    }
    await payrollPeriodRepository.deleteById(id);
    await auditService.record({
      userId: auditUserId, resource: 'payrollPeriod', action: 'delete', resourceId: id,
      changes: { name: period.name },
    });
    log.info({ action: 'delete', periodId: id });
    return { id };
  },

  /** Re-open attendance for editing (only before the period is closed/paid). */
  async unlockAttendance(id: string, auditUserId: string) {
    const period = await payrollPeriodRepository.findById(id);
    if (!period) throw new NotFoundError('Payroll period');
    if (period.status === 'closed' || period.status === 'paid') {
      throw new HttpError(409, `Kỳ lương đã ${period.status}, không thể mở chốt`, 'PAY_PERIOD_LOCKED');
    }
    const updated = await payrollPeriodRepository.updateById(id, {
      attendanceLockedAt: null,
      attendanceLockedBy: null,
    });
    await auditService.record({
      userId: auditUserId, resource: 'payrollPeriod', action: 'update', resourceId: id,
      changes: { attendanceLocked: false },
    });
    log.info({ action: 'unlock-attendance', periodId: id });
    return updated!.toJSON();
  },
};
