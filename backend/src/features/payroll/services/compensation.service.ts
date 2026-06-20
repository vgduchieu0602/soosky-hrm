import mongoose from 'mongoose';
import { logger } from '@core/logger/logger';
import { NotFoundError } from '@shared/errors/not-found.error';
import { auditService } from '@features/iam/services/audit.service';
import {
  allowanceRepository,
  bonusRepository,
  deductionRepository,
  taxProfileRepository,
} from '@features/payroll/repositories/compensation.repository';
import type {
  CreateAllowanceDto,
  CreateBonusDto,
  CreateDeductionDto,
  UpdateAllowanceDto,
  UpdateBonusDto,
  UpdateDeductionDto,
  UpsertTaxProfileDto,
} from '@features/payroll/dto/compensation.dto';

const log = logger.child({ feature: 'payroll', module: 'compensation' });
const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));

async function audit(
  auditUserId: string,
  resource: string,
  action: 'create' | 'update' | 'delete',
  resourceId: string,
) {
  await auditService.record({ userId: auditUserId, resource, action, resourceId });
}

// ============================ Allowance ============================
export const allowanceService = {
  listByEmployee(employeeId: string) {
    return allowanceRepository.listByEmployee(employeeId);
  },

  async create(input: CreateAllowanceDto, auditUserId: string) {
    const created = await allowanceRepository.create({
      ...input,
      amount: dec(input.amount),
    } as never);
    await audit(auditUserId, 'allowance', 'create', created._id.toString());
    log.info({ action: 'create-allowance', employeeId: input.employeeId });
    return created.toJSON();
  },

  async update(id: string, input: UpdateAllowanceDto, auditUserId: string) {
    const patch: Record<string, unknown> = { ...input };
    if (input.amount != null) patch.amount = dec(input.amount);
    const updated = await allowanceRepository.updateById(id, patch);
    if (!updated) throw new NotFoundError('Allowance');
    await audit(auditUserId, 'allowance', 'update', id);
    return updated.toJSON();
  },

  async remove(id: string, auditUserId: string) {
    const removed = await allowanceRepository.deleteById(id);
    if (!removed) throw new NotFoundError('Allowance');
    await audit(auditUserId, 'allowance', 'delete', id);
    return { id };
  },
};

// ============================ Bonus ============================
export const bonusService = {
  listByEmployee(employeeId: string) {
    return bonusRepository.listByEmployee(employeeId);
  },

  async create(input: CreateBonusDto, auditUserId: string) {
    const created = await bonusRepository.create({
      ...input,
      amount: dec(input.amount),
      approvedBy: new mongoose.Types.ObjectId(auditUserId),
    } as never);
    await audit(auditUserId, 'bonus', 'create', created._id.toString());
    log.info({ action: 'create-bonus', employeeId: input.employeeId });
    return created.toJSON();
  },

  async update(id: string, input: UpdateBonusDto, auditUserId: string) {
    const patch: Record<string, unknown> = { ...input };
    if (input.amount != null) patch.amount = dec(input.amount);
    const updated = await bonusRepository.updateById(id, patch);
    if (!updated) throw new NotFoundError('Bonus');
    await audit(auditUserId, 'bonus', 'update', id);
    return updated.toJSON();
  },

  async remove(id: string, auditUserId: string) {
    const removed = await bonusRepository.deleteById(id);
    if (!removed) throw new NotFoundError('Bonus');
    await audit(auditUserId, 'bonus', 'delete', id);
    return { id };
  },
};

// ============================ Deduction ============================
export const deductionService = {
  listByEmployee(employeeId: string) {
    return deductionRepository.listByEmployee(employeeId);
  },

  async create(input: CreateDeductionDto, auditUserId: string) {
    const created = await deductionRepository.create({
      ...input,
      amount: dec(input.amount),
    } as never);
    await audit(auditUserId, 'deduction', 'create', created._id.toString());
    log.info({ action: 'create-deduction', employeeId: input.employeeId });
    return created.toJSON();
  },

  async update(id: string, input: UpdateDeductionDto, auditUserId: string) {
    const patch: Record<string, unknown> = { ...input };
    if (input.amount != null) patch.amount = dec(input.amount);
    const updated = await deductionRepository.updateById(id, patch);
    if (!updated) throw new NotFoundError('Deduction');
    await audit(auditUserId, 'deduction', 'update', id);
    return updated.toJSON();
  },

  async remove(id: string, auditUserId: string) {
    const removed = await deductionRepository.deleteById(id);
    if (!removed) throw new NotFoundError('Deduction');
    await audit(auditUserId, 'deduction', 'delete', id);
    return { id };
  },
};

// ============================ Tax profile ============================
export const taxProfileService = {
  listByEmployee(employeeId: string) {
    return taxProfileRepository.listByEmployee(employeeId);
  },

  /** Append a new versioned tax profile (effective-dated). */
  async upsert(input: UpsertTaxProfileDto, auditUserId: string) {
    const created = await taxProfileRepository.create(input as never);
    await audit(auditUserId, 'employeeTaxProfile', 'create', created._id.toString());
    log.info({ action: 'upsert-tax-profile', employeeId: input.employeeId });
    return created.toJSON();
  },
};
