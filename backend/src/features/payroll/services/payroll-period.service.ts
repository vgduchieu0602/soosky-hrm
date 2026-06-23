import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { CompanyConfig } from '@shared/models/company-config.model';
import { auditService } from '@features/iam/services/audit.service';
import { payrollPeriodRepository } from '@features/payroll/repositories/payroll-period.repository';
import { standardWorkDaysInRange } from '@features/payroll/services/workdays.service';
import type {
  CreatePeriodDto,
  UpdatePeriodDto,
} from '@features/payroll/dto/payroll-period.dto';

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
    return updated!.toJSON();
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
