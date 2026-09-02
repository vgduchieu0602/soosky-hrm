import mongoose, { Types } from 'mongoose';
import { Payroll, type IPayroll } from '@modules/hrm/adapters/persistence/mongoose/models/payroll.model';
import { Allowance } from '@modules/hrm/adapters/persistence/mongoose/models/allowance.model';
import { Bonus } from '@modules/hrm/adapters/persistence/mongoose/models/bonus.model';
import { Deduction } from '@modules/hrm/adapters/persistence/mongoose/models/deduction.model';
import { EmployeeTaxProfile } from '@modules/hrm/adapters/persistence/mongoose/models/employee-tax-profile.model';
import type {
  PayrollRepository,
  AllowanceRepository,
  BonusRepository,
  DeductionRepository,
  TaxProfileRepository,
  AllowanceRecord,
  BonusRecord,
  DeductionRecord,
  TaxProfileRecord,
  ListPayrollFilter,
  PayrollTotalsRow,
  Id,
  Tx,
} from '@modules/hrm/core/payroll/domain/ports';
import type {
  CreateAllowanceDto,
  UpdateAllowanceDto,
  CreateBonusDto,
  UpdateBonusDto,
  CreateDeductionDto,
  UpdateDeductionDto,
  UpsertTaxProfileDto,
} from '@modules/hrm/core/payroll/dto/compensation.dto';

const valid = (id: string) => Types.ObjectId.isValid(id);
const dec = (n: number) => mongoose.Types.Decimal128.fromString(String(n));
const session = (tx: Tx) => tx as mongoose.ClientSession;

// ============================ Computed payrolls ============================
function buildFilter(f: ListPayrollFilter): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.payrollPeriodId && Types.ObjectId.isValid(f.payrollPeriodId)) {
    out.payrollPeriodId = new Types.ObjectId(f.payrollPeriodId);
  }
  if (f.employeeId && Types.ObjectId.isValid(f.employeeId)) {
    out.employeeId = new Types.ObjectId(f.employeeId);
  }
  if (f.status) out.status = f.status;
  return out;
}

export class MongoosePayrollRepository implements PayrollRepository {
  findById(id: Id) {
    if (!valid(id)) return Promise.resolve(null);
    return Payroll.findById(id).lean() as unknown as Promise<IPayroll | null>;
  }

  async findStatusById(id: Id) {
    if (!valid(id)) return null;
    const doc = await Payroll.findById(id).select('status').lean();
    return doc ? { _id: doc._id, status: doc.status as string } : null;
  }

  async findExisting(periodId: Id, employeeId: Id) {
    const doc = await Payroll.findOne({ payrollPeriodId: periodId, employeeId }).lean();
    return doc ? { status: doc.status as string } : null;
  }

  async paginate(filter: ListPayrollFilter, page: number, limit: number) {
    const match = buildFilter(filter);
    const [items, total] = await Promise.all([
      Payroll.find(match)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payroll.countDocuments(match),
    ]);
    return { items: items as unknown as IPayroll[], total };
  }

  totalsForPeriod(periodId: Id): Promise<PayrollTotalsRow[]> {
    if (!valid(periodId)) return Promise.resolve([]);
    return Payroll.aggregate<PayrollTotalsRow>([
      { $match: { payrollPeriodId: new Types.ObjectId(periodId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          gross: { $sum: { $toDouble: '$grossSalary' } },
          net: { $sum: { $toDouble: '$netSalary' } },
        },
      },
    ]);
  }

  exportRows(periodId: Id): Promise<Record<string, unknown>[]> {
    return Payroll.aggregate([
      { $match: { payrollPeriodId: new mongoose.Types.ObjectId(periodId) } },
      { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'emp' } },
      { $unwind: { path: '$emp', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'employeeProfiles', localField: 'employeeId', foreignField: 'employeeId', as: 'profile' } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'departments', localField: 'emp.departmentId', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $sort: { 'emp.employeeCode': 1 } },
    ]);
  }

  countByPeriod(periodId: Id) {
    return Payroll.countDocuments({ payrollPeriodId: periodId });
  }

  countDrafts(periodId: Id, employeeId?: Id) {
    const filter: Record<string, unknown> = { payrollPeriodId: periodId, status: 'draft' };
    if (employeeId) filter.employeeId = employeeId;
    return Payroll.countDocuments(filter);
  }

  countApproved(periodId: Id) {
    return Payroll.countDocuments({ payrollPeriodId: periodId, status: 'approved' });
  }

  async reopenApprovedToDraft(periodId: Id) {
    const res = await Payroll.updateMany(
      { payrollPeriodId: periodId, status: 'approved' },
      { $set: { status: 'draft' }, $unset: { approvedBy: '' } },
    );
    return res.modifiedCount;
  }

  async deleteDrafts(periodId: Id) {
    const result = await Payroll.deleteMany({ payrollPeriodId: periodId, status: 'draft' });
    return result.deletedCount ?? 0;
  }

  async upsertComputed(periodId: Id, employeeId: Id, doc: IPayroll, tx: Tx): Promise<IPayroll> {
    const row = await Payroll.findOneAndUpdate(
      { payrollPeriodId: periodId, employeeId },
      { $set: doc },
      { upsert: true, new: true, session: session(tx) },
    );
    return row as unknown as IPayroll;
  }

  async approveMany(periodId: Id, employeeId: Id | undefined, approverUserId: Id, tx: Tx) {
    const filter: Record<string, unknown> = { payrollPeriodId: periodId, status: 'draft' };
    if (employeeId) filter.employeeId = employeeId;
    await Payroll.updateMany(
      filter,
      { $set: { status: 'approved', approvedBy: new mongoose.Types.ObjectId(approverUserId) } },
      { session: session(tx) },
    );
  }

  async markPaidMany(periodId: Id, paidAt: Date, tx: Tx) {
    await Payroll.updateMany(
      { payrollPeriodId: periodId, status: 'approved' },
      { $set: { status: 'paid', paidAt } },
      { session: session(tx) },
    );
  }

  async revertToDraft(payrollId: Id) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) return;
    payroll.status = 'draft';
    payroll.approvedBy = null;
    await payroll.save();
  }
}

// ============================ Compensation ============================
export class MongooseAllowanceRepository implements AllowanceRepository {
  listByEmployee(employeeId: Id) {
    if (!valid(employeeId)) return Promise.resolve([]);
    return Allowance.find({ employeeId }).sort({ effectiveDate: -1 }).lean() as unknown as Promise<AllowanceRecord[]>;
  }

  async create(input: CreateAllowanceDto) {
    const created = await Allowance.create({ ...input, amount: dec(input.amount) } as never);
    return created.toJSON() as unknown as AllowanceRecord;
  }

  async update(id: Id, patch: UpdateAllowanceDto) {
    if (!valid(id)) return null;
    const doc: Record<string, unknown> = { ...patch };
    if (patch.amount != null) doc.amount = dec(patch.amount);
    const updated = await Allowance.findByIdAndUpdate(id, doc, { new: true });
    return updated ? (updated.toJSON() as unknown as AllowanceRecord) : null;
  }

  async delete(id: Id) {
    if (!valid(id)) return false;
    return !!(await Allowance.findByIdAndDelete(id));
  }

  findActiveForPeriod(employeeId: Id, start: Date, end: Date) {
    return Allowance.find({
      employeeId,
      effectiveDate: { $lte: end },
      $or: [{ endDate: null }, { endDate: { $gte: start } }],
    }).lean() as unknown as Promise<AllowanceRecord[]>;
  }
}

export class MongooseBonusRepository implements BonusRepository {
  listByEmployee(employeeId: Id) {
    if (!valid(employeeId)) return Promise.resolve([]);
    return Bonus.find({ employeeId }).sort({ created_at: -1 }).lean() as unknown as Promise<BonusRecord[]>;
  }

  async create(input: CreateBonusDto, approvedByUserId: Id) {
    const created = await Bonus.create({
      ...input,
      amount: dec(input.amount),
      approvedBy: new mongoose.Types.ObjectId(approvedByUserId),
    } as never);
    return created.toJSON() as unknown as BonusRecord;
  }

  async update(id: Id, patch: UpdateBonusDto) {
    if (!valid(id)) return null;
    const doc: Record<string, unknown> = { ...patch };
    if (patch.amount != null) doc.amount = dec(patch.amount);
    const updated = await Bonus.findByIdAndUpdate(id, doc, { new: true });
    return updated ? (updated.toJSON() as unknown as BonusRecord) : null;
  }

  async delete(id: Id) {
    if (!valid(id)) return false;
    return !!(await Bonus.findByIdAndDelete(id));
  }

  findForPeriod(employeeId: Id, periodId: Id) {
    return Bonus.find({ employeeId, payrollPeriodId: periodId }).lean() as unknown as Promise<BonusRecord[]>;
  }
}

export class MongooseDeductionRepository implements DeductionRepository {
  listByEmployee(employeeId: Id) {
    if (!valid(employeeId)) return Promise.resolve([]);
    return Deduction.find({ employeeId }).sort({ effectiveDate: -1 }).lean() as unknown as Promise<DeductionRecord[]>;
  }

  async create(input: CreateDeductionDto) {
    const created = await Deduction.create({ ...input, amount: dec(input.amount) } as never);
    return created.toJSON() as unknown as DeductionRecord;
  }

  async update(id: Id, patch: UpdateDeductionDto) {
    if (!valid(id)) return null;
    const doc: Record<string, unknown> = { ...patch };
    if (patch.amount != null) doc.amount = dec(patch.amount);
    const updated = await Deduction.findByIdAndUpdate(id, doc, { new: true });
    return updated ? (updated.toJSON() as unknown as DeductionRecord) : null;
  }

  async delete(id: Id) {
    if (!valid(id)) return false;
    return !!(await Deduction.findByIdAndDelete(id));
  }

  findActiveForPeriod(employeeId: Id, periodId: Id, start: Date, end: Date) {
    return Deduction.find({
      employeeId,
      effectiveDate: { $lte: end },
      $and: [
        { $or: [{ payrollPeriodId: null }, { payrollPeriodId: periodId }] },
        { $or: [{ endDate: null }, { endDate: { $gte: start } }] },
      ],
    }).lean() as unknown as Promise<DeductionRecord[]>;
  }
}

export class MongooseTaxProfileRepository implements TaxProfileRepository {
  listByEmployee(employeeId: Id) {
    if (!valid(employeeId)) return Promise.resolve([]);
    return EmployeeTaxProfile.find({ employeeId })
      .sort({ effectiveDate: -1 })
      .lean() as unknown as Promise<TaxProfileRecord[]>;
  }

  async create(input: UpsertTaxProfileDto) {
    const created = await EmployeeTaxProfile.create(input as never);
    return created.toJSON() as unknown as TaxProfileRecord;
  }

  findEffective(employeeId: Id, date: Date) {
    return EmployeeTaxProfile.findOne({ employeeId, effectiveDate: { $lte: date } })
      .sort({ effectiveDate: -1 })
      .lean() as unknown as Promise<TaxProfileRecord | null>;
  }

  async employeeIdsEffective(employeeIds: Id[], date: Date) {
    const rows = await EmployeeTaxProfile.find({
      employeeId: { $in: employeeIds },
      effectiveDate: { $lte: date },
    })
      .select('employeeId')
      .lean();
    return rows.map((t) => String(t.employeeId));
  }
}
