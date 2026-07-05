import mongoose, { Types } from 'mongoose';
import { CompanyConfig } from '@shared/models/company-config.model';
import { SalaryPolicyConfig } from '@shared/models/salary-policy-config.model';
import { PerformanceCriterion } from '@shared/models/performance-criterion.model';
import { Bank } from '@shared/models/bank.model';
import type {
  BankRepository,
  CompanyConfigRepository,
  Id,
  PerformanceCriterionRepository,
  Persisted,
  SalaryPolicyRepository,
} from '@features/settings/domain/ports';
import type {
  CreateBankDto,
  CreateSalaryPolicyDto,
  UpdateBankDto,
  UpdateCriterionDto,
  UpdateSalaryPolicyDto,
} from '@features/settings/dto/settings.dto';

const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const valid = (id: Id) => Types.ObjectId.isValid(id);
const persisted = (doc: { _id: unknown; toJSON(): Record<string, unknown> }): Persisted => ({
  id: String(doc._id),
  data: doc.toJSON(),
});

// ============================ Company config ============================
export class MongooseCompanyConfigRepository implements CompanyConfigRepository {
  async getOrCreate() {
    const existing = await CompanyConfig.findOne({ key: 'global' });
    if (existing) return existing.toJSON() as unknown as Record<string, unknown>;
    const created = await CompanyConfig.create({ key: 'global' });
    return created.toJSON() as unknown as Record<string, unknown>;
  }

  async update(input: Record<string, unknown>) {
    const updated = await CompanyConfig.findOneAndUpdate(
      { key: 'global' },
      { $set: input },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return persisted(updated!);
  }
}

// ============================ Salary policy ============================
export class MongooseSalaryPolicyRepository implements SalaryPolicyRepository {
  list() {
    return SalaryPolicyConfig.find({})
      .sort({ year: -1, effectiveFrom: -1 })
      .lean() as unknown as Promise<Record<string, unknown>[]>;
  }

  async existsByKey(country: string, year: number, effectiveFrom: Date) {
    const dup = await SalaryPolicyConfig.findOne({ country, year, effectiveFrom });
    return !!dup;
  }

  async create(input: CreateSalaryPolicyDto, createdBy: Id) {
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
      createdBy: new Types.ObjectId(createdBy),
    });
    return persisted(doc);
  }

  async update(id: Id, input: UpdateSalaryPolicyDto, updatedBy: Id) {
    if (!valid(id)) return null;
    const patch: Record<string, unknown> = { updatedBy: new Types.ObjectId(updatedBy) };
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
    return updated ? persisted(updated) : null;
  }
}

// ============================ Performance criteria ============================
export class MongoosePerformanceCriterionRepository implements PerformanceCriterionRepository {
  list(includeArchived: boolean) {
    const filter = includeArchived ? {} : { status: 'active' as const };
    return PerformanceCriterion.find(filter)
      .sort({ order: 1, created_at: 1 })
      .lean() as unknown as Promise<Record<string, unknown>[]>;
  }

  async existsByKey(key: string) {
    return !!(await PerformanceCriterion.exists({ key }));
  }

  async create(data: { key: string; label: string; description?: string; type: string; order: number }) {
    const doc = await PerformanceCriterion.create({
      key: data.key,
      label: data.label,
      description: data.description,
      type: data.type as 'performance' | 'goal',
      order: data.order,
      status: 'active',
    });
    return persisted(doc);
  }

  async update(id: Id, input: UpdateCriterionDto) {
    if (!valid(id)) return null;
    const existing = await PerformanceCriterion.findById(id).lean();
    if (!existing) return null;
    const updated = await PerformanceCriterion.findByIdAndUpdate(id, input, { new: true });
    return updated ? persisted(updated) : null;
  }

  async archive(id: Id) {
    if (!valid(id)) return null;
    const updated = await PerformanceCriterion.findByIdAndUpdate(id, { status: 'archived' }, { new: true });
    return updated ? persisted(updated) : null;
  }
}

// ============================ Banks ============================
export class MongooseBankRepository implements BankRepository {
  list() {
    return Bank.find({}).sort({ name: 1 }).lean() as unknown as Promise<Record<string, unknown>[]>;
  }

  async create(input: CreateBankDto) {
    const doc = await Bank.create({
      name: input.name,
      ...(input.code !== undefined && { code: input.code }),
      status: 'active',
    });
    return persisted(doc);
  }

  async update(id: Id, input: UpdateBankDto) {
    if (!valid(id)) return null;
    const updated = await Bank.findByIdAndUpdate(id, input, { new: true });
    return updated ? persisted(updated) : null;
  }

  async archive(id: Id) {
    if (!valid(id)) return null;
    const updated = await Bank.findByIdAndUpdate(id, { status: 'archived' }, { new: true });
    return updated ? persisted(updated) : null;
  }
}
