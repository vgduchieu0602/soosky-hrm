import mongoose, { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { CompanyConfig } from '@shared/models/company-config.model';
import { SalaryPolicyConfig } from '@shared/models/salary-policy-config.model';
import { PerformanceCriterion } from '@shared/models/performance-criterion.model';
import { auditService } from '@features/iam/services/audit.service';
import type {
  CreateCriterionDto,
  CreateSalaryPolicyDto,
  UpdateCompanyConfigDto,
  UpdateCriterionDto,
  UpdateSalaryPolicyDto,
} from '@features/settings/dto/settings.dto';

const log = logger.child({ feature: 'settings' });

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));

// ============================ Company config ============================
export const companyConfigService = {
  async get() {
    // Upsert-on-read: there is always exactly one config document.
    const existing = await CompanyConfig.findOne({ key: 'global' });
    if (existing) return existing.toJSON();
    const created = await CompanyConfig.create({ key: 'global' });
    return created.toJSON();
  },

  async update(input: UpdateCompanyConfigDto, auditUserId: string) {
    const updated = await CompanyConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: input },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await auditService.record({
      userId: auditUserId,
      resource: 'companyConfig',
      action: 'update',
      resourceId: updated!._id.toString(),
      changes: input as Record<string, unknown>,
    });
    log.info('company config updated');
    return updated!.toJSON();
  },
};

// ============================ Salary policy ============================
export const salaryPolicyService = {
  async list() {
    const rows = await SalaryPolicyConfig.find({}).sort({ year: -1, effectiveFrom: -1 }).lean();
    return rows;
  },

  async create(input: CreateSalaryPolicyDto, auditUserId: string) {
    const dup = await SalaryPolicyConfig.findOne({
      country: input.country.toUpperCase(),
      year: input.year,
      effectiveFrom: input.effectiveFrom,
    });
    if (dup) throw new HttpError(409, 'Policy for this country/year/date already exists', 'SET_001');

    const doc = await SalaryPolicyConfig.create({
      country: input.country.toUpperCase(),
      year: input.year,
      effectiveFrom: input.effectiveFrom,
      baseSalary: dec(input.baseSalary),
      ...(input.insuranceCeilingMultiplier !== undefined && {
        insuranceCeilingMultiplier: input.insuranceCeilingMultiplier,
      }),
      ...(input.personalDeduction !== undefined && {
        personalDeduction: dec(input.personalDeduction),
      }),
      ...(input.dependentDeduction !== undefined && {
        dependentDeduction: dec(input.dependentDeduction),
      }),
      ...(input.nonResidentTaxRate !== undefined && {
        nonResidentTaxRate: input.nonResidentTaxRate,
      }),
      ...(input.salaryComponentWeights && {
        salaryComponentWeights: input.salaryComponentWeights,
      }),
      ...(input.regionalMinWage && { regionalMinWage: input.regionalMinWage }),
      ...(input.taxBrackets && { taxBrackets: input.taxBrackets }),
      ...(input.insuranceRates && { insuranceRates: input.insuranceRates }),
      ...(input.socialInsuranceSalary !== undefined && {
        socialInsuranceSalary: dec(input.socialInsuranceSalary),
      }),
      ...(input.unionFeeRate !== undefined && { unionFeeRate: input.unionFeeRate }),
      ...(input.unionFeeEnabled !== undefined && { unionFeeEnabled: input.unionFeeEnabled }),
      ...(input.probationPayRate !== undefined && { probationPayRate: input.probationPayRate }),
      createdBy: new Types.ObjectId(auditUserId),
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'salaryPolicyConfig',
      action: 'create',
      resourceId: doc._id.toString(),
    });
    return doc.toJSON();
  },

  async update(id: string, input: UpdateSalaryPolicyDto, auditUserId: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Policy not found', 'SET_002');
    const patch: Record<string, unknown> = { updatedBy: new Types.ObjectId(auditUserId) };
    if (input.effectiveFrom !== undefined) patch.effectiveFrom = input.effectiveFrom;
    if (input.baseSalary !== undefined) patch.baseSalary = dec(input.baseSalary);
    if (input.insuranceCeilingMultiplier !== undefined)
      patch.insuranceCeilingMultiplier = input.insuranceCeilingMultiplier;
    if (input.personalDeduction !== undefined) patch.personalDeduction = dec(input.personalDeduction);
    if (input.dependentDeduction !== undefined)
      patch.dependentDeduction = dec(input.dependentDeduction);
    if (input.nonResidentTaxRate !== undefined) patch.nonResidentTaxRate = input.nonResidentTaxRate;
    if (input.salaryComponentWeights) patch.salaryComponentWeights = input.salaryComponentWeights;
    if (input.regionalMinWage) patch.regionalMinWage = input.regionalMinWage;
    if (input.taxBrackets) patch.taxBrackets = input.taxBrackets;
    if (input.insuranceRates) patch.insuranceRates = input.insuranceRates;
    if (input.socialInsuranceSalary !== undefined)
      patch.socialInsuranceSalary = dec(input.socialInsuranceSalary);
    if (input.unionFeeRate !== undefined) patch.unionFeeRate = input.unionFeeRate;
    if (input.unionFeeEnabled !== undefined) patch.unionFeeEnabled = input.unionFeeEnabled;
    if (input.probationPayRate !== undefined) patch.probationPayRate = input.probationPayRate;

    const updated = await SalaryPolicyConfig.findByIdAndUpdate(id, patch, { new: true });
    if (!updated) throw new HttpError(404, 'Policy not found', 'SET_002');
    await auditService.record({
      userId: auditUserId,
      resource: 'salaryPolicyConfig',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },
};

// ============================ Performance criteria ============================
// Criteria are equally weighted — the evaluation ratio is a simple average of
// each type's sub-indicators, so no per-criterion weight is stored.
export const performanceCriterionService = {
  async list(includeArchived = false) {
    const filter = includeArchived ? {} : { status: 'active' as const };
    return PerformanceCriterion.find(filter).sort({ order: 1, created_at: 1 }).lean();
  },

  async create(input: CreateCriterionDto, auditUserId: string) {
    const type = input.type ?? 'performance';
    // Admin only names the criterion — key is auto-generated; criteria are
    // equally weighted (ratio = simple average), so no weight input is required.
    const baseKey = (input.key?.trim() || input.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')) || 'criterion';
    let key = baseKey;
    for (let i = 2; await PerformanceCriterion.exists({ key }); i += 1) key = `${baseKey}_${i}`;
    const doc = await PerformanceCriterion.create({
      key,
      label: input.label,
      description: input.description,
      type,
      order: input.order ?? 0,
      status: 'active',
    });
    await auditService.record({
      userId: auditUserId,
      resource: 'performanceCriterion',
      action: 'create',
      resourceId: doc._id.toString(),
    });
    return doc.toJSON();
  },

  async update(id: string, input: UpdateCriterionDto, auditUserId: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Criterion not found', 'SET_004');
    const existing = await PerformanceCriterion.findById(id).lean();
    if (!existing) throw new HttpError(404, 'Criterion not found', 'SET_004');
    const updated = await PerformanceCriterion.findByIdAndUpdate(id, input, { new: true });
    if (!updated) throw new HttpError(404, 'Criterion not found', 'SET_004');
    await auditService.record({
      userId: auditUserId,
      resource: 'performanceCriterion',
      action: 'update',
      resourceId: id,
      changes: input as Record<string, unknown>,
    });
    return updated.toJSON();
  },

  async archive(id: string, auditUserId: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Criterion not found', 'SET_004');
    const updated = await PerformanceCriterion.findByIdAndUpdate(
      id,
      { status: 'archived' },
      { new: true },
    );
    if (!updated) throw new HttpError(404, 'Criterion not found', 'SET_004');
    await auditService.record({
      userId: auditUserId,
      resource: 'performanceCriterion',
      action: 'delete',
      resourceId: id,
      changes: { status: 'archived' },
    });
    return updated.toJSON();
  },
};
