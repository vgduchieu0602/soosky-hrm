import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { NotFoundError } from '@shared/errors/not-found.error';
import { CompanyConfig } from '@shared/models/company-config.model';
import { auditService } from '@features/iam/services/audit.service';
import { payrollPeriodRepository } from '@features/payroll/repositories/payroll-period.repository';
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

    let standardWorkDays = input.standardWorkDays;
    if (standardWorkDays == null) {
      const config = await CompanyConfig.findOne({ key: 'global' }).lean();
      standardWorkDays = config?.standardWorkDays ?? 22;
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
};
