import { logger } from '@core/logger/logger';
import { NotFoundError } from '@shared/errors/not-found.error';
import type {
  AllowanceRepository,
  BonusRepository,
  DeductionRepository,
  TaxProfileRepository,
  AuditPort,
  Id,
} from '@features/payroll/domain/ports';
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

export class AllowanceUseCases {
  constructor(private readonly repo: AllowanceRepository, private readonly audit: AuditPort) {}

  listByEmployee(employeeId: Id) {
    return this.repo.listByEmployee(employeeId);
  }

  async create(input: CreateAllowanceDto, auditUserId: Id) {
    const created = await this.repo.create(input);
    await this.audit.record({ userId: auditUserId, resource: 'allowance', action: 'create', resourceId: String(created._id) });
    log.info({ action: 'create-allowance', employeeId: input.employeeId });
    return created;
  }

  async update(id: Id, input: UpdateAllowanceDto, auditUserId: Id) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Allowance');
    await this.audit.record({ userId: auditUserId, resource: 'allowance', action: 'update', resourceId: id });
    return updated;
  }

  async remove(id: Id, auditUserId: Id) {
    const removed = await this.repo.delete(id);
    if (!removed) throw new NotFoundError('Allowance');
    await this.audit.record({ userId: auditUserId, resource: 'allowance', action: 'delete', resourceId: id });
    return { id };
  }
}

export class BonusUseCases {
  constructor(private readonly repo: BonusRepository, private readonly audit: AuditPort) {}

  listByEmployee(employeeId: Id) {
    return this.repo.listByEmployee(employeeId);
  }

  async create(input: CreateBonusDto, auditUserId: Id) {
    const created = await this.repo.create(input, auditUserId);
    await this.audit.record({ userId: auditUserId, resource: 'bonus', action: 'create', resourceId: String(created._id) });
    log.info({ action: 'create-bonus', employeeId: input.employeeId });
    return created;
  }

  async update(id: Id, input: UpdateBonusDto, auditUserId: Id) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Bonus');
    await this.audit.record({ userId: auditUserId, resource: 'bonus', action: 'update', resourceId: id });
    return updated;
  }

  async remove(id: Id, auditUserId: Id) {
    const removed = await this.repo.delete(id);
    if (!removed) throw new NotFoundError('Bonus');
    await this.audit.record({ userId: auditUserId, resource: 'bonus', action: 'delete', resourceId: id });
    return { id };
  }
}

export class DeductionUseCases {
  constructor(private readonly repo: DeductionRepository, private readonly audit: AuditPort) {}

  listByEmployee(employeeId: Id) {
    return this.repo.listByEmployee(employeeId);
  }

  async create(input: CreateDeductionDto, auditUserId: Id) {
    const created = await this.repo.create(input);
    await this.audit.record({ userId: auditUserId, resource: 'deduction', action: 'create', resourceId: String(created._id) });
    log.info({ action: 'create-deduction', employeeId: input.employeeId });
    return created;
  }

  async update(id: Id, input: UpdateDeductionDto, auditUserId: Id) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Deduction');
    await this.audit.record({ userId: auditUserId, resource: 'deduction', action: 'update', resourceId: id });
    return updated;
  }

  async remove(id: Id, auditUserId: Id) {
    const removed = await this.repo.delete(id);
    if (!removed) throw new NotFoundError('Deduction');
    await this.audit.record({ userId: auditUserId, resource: 'deduction', action: 'delete', resourceId: id });
    return { id };
  }
}

export class TaxProfileUseCases {
  constructor(private readonly repo: TaxProfileRepository, private readonly audit: AuditPort) {}

  listByEmployee(employeeId: Id) {
    return this.repo.listByEmployee(employeeId);
  }

  /** Append a new versioned tax profile (effective-dated). */
  async upsert(input: UpsertTaxProfileDto, auditUserId: Id) {
    const created = await this.repo.create(input);
    await this.audit.record({ userId: auditUserId, resource: 'employeeTaxProfile', action: 'create', resourceId: String(created._id) });
    log.info({ action: 'upsert-tax-profile', employeeId: input.employeeId });
    return created;
  }
}
