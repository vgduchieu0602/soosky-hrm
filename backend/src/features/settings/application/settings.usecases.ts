import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { baseCriterionKey } from '@features/settings/domain/criterion';
import type {
  AuditPort,
  BankRepository,
  CompanyConfigRepository,
  PerformanceCriterionRepository,
  SalaryPolicyRepository,
} from '@features/settings/domain/ports';
import type {
  CreateBankDto,
  CreateCriterionDto,
  CreateSalaryPolicyDto,
  UpdateBankDto,
  UpdateCompanyConfigDto,
  UpdateCriterionDto,
  UpdateSalaryPolicyDto,
} from '@features/settings/dto/settings.dto';

const log = logger.child({ feature: 'settings' });

// ============================ Company config ============================
export class CompanyConfigUseCases {
  constructor(
    private readonly repo: CompanyConfigRepository,
    private readonly audit: AuditPort,
  ) {}

  get() {
    return this.repo.getOrCreate();
  }

  async update(input: UpdateCompanyConfigDto, auditUserId: string) {
    const { id, data } = await this.repo.update(input);
    await this.audit.record({
      userId: auditUserId,
      resource: 'companyConfig',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    log.info('company config updated');
    return data;
  }
}

// ============================ Salary policy ============================
export class SalaryPolicyUseCases {
  constructor(
    private readonly repo: SalaryPolicyRepository,
    private readonly audit: AuditPort,
  ) {}

  list() {
    return this.repo.list();
  }

  async create(input: CreateSalaryPolicyDto, auditUserId: string) {
    const country = input.country.toUpperCase();
    const dup = await this.repo.existsByKey(country, input.year, input.effectiveFrom);
    if (dup) throw new HttpError(409, 'Policy for this country/year/date already exists', 'SET_001');

    const { id, data } = await this.repo.create(input, auditUserId);
    await this.audit.record({
      userId: auditUserId,
      resource: 'salaryPolicyConfig',
      action: 'create',
      resourceId: id,
    });
    return data;
  }

  async update(id: string, input: UpdateSalaryPolicyDto, auditUserId: string) {
    const updated = await this.repo.update(id, input, auditUserId);
    if (!updated) throw new HttpError(404, 'Policy not found', 'SET_002');
    await this.audit.record({
      userId: auditUserId,
      resource: 'salaryPolicyConfig',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated.data;
  }
}

// ============================ Performance criteria ============================
// Criteria are equally weighted — the evaluation ratio is a simple average of
// each type's sub-indicators, so no per-criterion weight is stored.
export class PerformanceCriterionUseCases {
  constructor(
    private readonly repo: PerformanceCriterionRepository,
    private readonly audit: AuditPort,
  ) {}

  list(includeArchived = false) {
    return this.repo.list(includeArchived);
  }

  async create(input: CreateCriterionDto, auditUserId: string) {
    const type = input.type ?? 'performance';
    // Admin only names the criterion — key is auto-generated; criteria are
    // equally weighted (ratio = simple average), so no weight input is required.
    const base = baseCriterionKey(input.label, input.key);
    let key = base;
    for (let i = 2; await this.repo.existsByKey(key); i += 1) key = `${base}_${i}`;
    const { id, data } = await this.repo.create({
      key,
      label: input.label,
      description: input.description,
      type,
      order: input.order ?? 0,
    });
    await this.audit.record({
      userId: auditUserId,
      resource: 'performanceCriterion',
      action: 'create',
      resourceId: id,
    });
    return data;
  }

  async update(id: string, input: UpdateCriterionDto, auditUserId: string) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new HttpError(404, 'Criterion not found', 'SET_004');
    await this.audit.record({
      userId: auditUserId,
      resource: 'performanceCriterion',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated.data;
  }

  async archive(id: string, auditUserId: string) {
    const updated = await this.repo.archive(id);
    if (!updated) throw new HttpError(404, 'Criterion not found', 'SET_004');
    await this.audit.record({
      userId: auditUserId,
      resource: 'performanceCriterion',
      action: 'delete',
      resourceId: id,
      changes: { status: 'archived' },
    });
    return updated.data;
  }
}

// ============================ Banks ============================
export class BankUseCases {
  constructor(
    private readonly repo: BankRepository,
    private readonly audit: AuditPort,
  ) {}

  list() {
    return this.repo.list();
  }

  async create(input: CreateBankDto, auditUserId: string) {
    const { id, data } = await this.repo.create(input);
    await this.audit.record({
      userId: auditUserId,
      resource: 'bank',
      action: 'create',
      resourceId: id,
    });
    return data;
  }

  async update(id: string, input: UpdateBankDto, auditUserId: string) {
    const updated = await this.repo.update(id, input);
    if (!updated) throw new HttpError(404, 'Bank not found', 'SET_005');
    await this.audit.record({
      userId: auditUserId,
      resource: 'bank',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated.data;
  }

  async archive(id: string, auditUserId: string) {
    const updated = await this.repo.archive(id);
    if (!updated) throw new HttpError(404, 'Bank not found', 'SET_005');
    await this.audit.record({
      userId: auditUserId,
      resource: 'bank',
      action: 'delete',
      resourceId: id,
      changes: { status: 'archived' },
    });
    return updated.data;
  }
}
