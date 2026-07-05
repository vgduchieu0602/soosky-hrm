import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { Employee } from '@shared/models/employee.model';
import { EmployeeProfile } from '@shared/models/employee-profile.model';
import { EmployeeContact } from '@shared/models/employee-contact.model';
import { EmployeeBankAccount } from '@shared/models/employee-bank-account.model';
import { EmployeeDocumentModel } from '@shared/models/employee-document.model';
import { EmployeeContractModel } from '@shared/models/employee-contract.model';
import { EmployeeAsset } from '@shared/models/employee-asset.model';
import { EmployeeHistory } from '@shared/models/employee-history.model';
import type {
  EmployeeRepository,
  EmployeeProfileRepository,
  ContactRepository,
  BankAccountRepository,
  DocumentRepository,
  AssetRepository,
  ContractRepository,
  HistoryRepository,
  CreateEmployeeData,
  PaginateOpts,
  ListEmployeesFilter,
  Doc,
  Id,
  Tx,
} from '@features/employee/domain/ports';

const valid = (id: Id) => Types.ObjectId.isValid(id);
const sess = (tx?: Tx) => (tx ? (tx as ClientSession) : undefined);
const json = (d: { toJSON(): Record<string, unknown> } | null) => (d ? (d.toJSON() as Doc) : null);

const toObjectIdFields = (input: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...input };
  for (const key of ['departmentId', 'positionId', 'managerId', 'shiftId'] as const) {
    const v = input[key];
    if (typeof v === 'string') out[key] = new Types.ObjectId(v);
    else if (v === null) out[key] = null;
  }
  return out;
};

export class MongooseEmployeeRepository implements EmployeeRepository {
  async findById(id: Id): Promise<Doc | null> {
    if (!valid(id)) return null;
    return (await Employee.findById(id).lean()) as Doc | null;
  }
  async findByIdJson(id: Id): Promise<Doc | null> {
    if (!valid(id)) return null;
    return json(await Employee.findById(id));
  }
  async findByIdPopulatedJson(id: Id): Promise<Doc | null> {
    if (!valid(id)) return null;
    const doc = await Employee.findById(id)
      .populate('departmentId', 'name code')
      .populate('positionId', 'title code level')
      .populate({ path: 'managerId', select: 'employeeCode' });
    return json(doc);
  }
  async findByCode(code: string): Promise<Doc | null> {
    return (await Employee.findOne({ employeeCode: code.trim() }).lean()) as Doc | null;
  }
  async findByUserIdJson(userId: Id): Promise<Doc | null> {
    if (!valid(userId)) return null;
    return json(await Employee.findOne({ userId }));
  }
  async findOtherByFingerprint(fingerprintId: string, exceptId: Id): Promise<Doc | null> {
    return (await Employee.findOne({ fingerprintId, _id: { $ne: exceptId } })
      .select('_id')
      .lean()) as Doc | null;
  }

  async paginate({ page, limit, sort, filter }: PaginateOpts): Promise<{ items: Doc[]; total: number }> {
    const match = buildFilter(filter);
    const lookups: PipelineStage[] = [
      { $lookup: { from: 'employeeProfiles', localField: '_id', foreignField: 'employeeId', as: 'profile' } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'positions', localField: 'positionId', foreignField: '_id', as: 'position' } },
      { $unwind: { path: '$position', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'employees',
          let: { mgrId: '$managerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$mgrId'] } } },
            { $lookup: { from: 'employeeProfiles', localField: '_id', foreignField: 'employeeId', as: 'profile' } },
            { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
            { $project: { employeeCode: 1, 'profile.firstName': 1, 'profile.middleName': 1, 'profile.lastName': 1 } },
          ],
          as: 'manager',
        },
      },
      { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
    ];

    const search = buildSearchMatch(filter.q);
    const searchStages: PipelineStage[] = search ? [{ $match: search }] : [];

    const project: PipelineStage = {
      $project: {
        employeeCode: 1,
        fingerprintId: 1,
        userId: 1,
        employeeType: 1,
        status: 1,
        salaryZone: 1,
        hireDate: 1,
        terminationDate: 1,
        created_at: 1,
        updated_at: 1,
        departmentId: { _id: '$department._id', name: '$department.name', code: '$department.code' },
        positionId: {
          _id: '$position._id',
          title: '$position.title',
          code: '$position.code',
          level: '$position.level',
        },
        managerId: {
          $cond: [
            { $ifNull: ['$manager._id', false] },
            {
              _id: '$manager._id',
              employeeCode: '$manager.employeeCode',
              profile: {
                firstName: '$manager.profile.firstName',
                middleName: '$manager.profile.middleName',
                lastName: '$manager.profile.lastName',
              },
            },
            null,
          ],
        },
        profile: {
          firstName: '$profile.firstName',
          middleName: '$profile.middleName',
          lastName: '$profile.lastName',
          email: '$profile.email',
          workEmail: '$profile.workEmail',
          phone: '$profile.phone',
          avatarUrl: '$profile.avatarUrl',
          gender: '$profile.gender',
          maritalStatus: '$profile.maritalStatus',
          nationality: '$profile.nationality',
        },
      },
    };

    const dataPipeline: PipelineStage[] = [
      { $match: match },
      ...lookups,
      ...searchStages,
      { $sort: sort ?? { created_at: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      project,
    ];
    const countPipeline: PipelineStage[] = [{ $match: match }, ...lookups, ...searchStages, { $count: 'total' }];

    const [items, countRes] = await Promise.all([
      Employee.aggregate(dataPipeline),
      Employee.aggregate<{ total: number }>(countPipeline),
    ]);
    return { items: items as Doc[], total: countRes[0]?.total ?? 0 };
  }

  async countByStatus(): Promise<{ _id: string; count: number }[]> {
    return Employee.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  }
  async countByDepartment(): Promise<{ _id: string; count: number }[]> {
    const rows = await Employee.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $ne: 'terminated' } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
    ]);
    return rows.map((r) => ({ _id: String(r._id), count: r.count }));
  }

  async create(data: CreateEmployeeData, tx: Tx): Promise<Doc> {
    const [employee] = await Employee.create(
      [
        {
          employeeCode: data.employeeCode,
          fingerprintId: data.fingerprintId,
          departmentId: new Types.ObjectId(data.departmentId),
          positionId: new Types.ObjectId(data.positionId),
          managerId: data.managerId ? new Types.ObjectId(data.managerId) : null,
          shiftId: data.shiftId ? new Types.ObjectId(data.shiftId) : null,
          hireDate: data.hireDate,
          employeeType: data.employeeType,
          salaryZone: data.salaryZone,
          status: 'onboarding',
          userId: null,
        },
      ] as any[],
      { session: sess(tx) },
    );
    return employee!.toJSON() as Doc;
  }

  async updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null> {
    if (!valid(id)) return null;
    return json(await Employee.findByIdAndUpdate(id, toObjectIdFields(patch), { new: true }));
  }

  async linkUser(employeeId: Id, userId: Id, tx?: Tx): Promise<void> {
    await Employee.updateOne({ _id: employeeId }, { userId }, { session: sess(tx) });
  }
  async unlinkUser(employeeId: Id): Promise<void> {
    await Employee.updateOne({ _id: employeeId }, { $unset: { userId: 1 } });
  }
  async setTerminated(id: Id, terminationDate: Date, tx: Tx): Promise<void> {
    await Employee.updateOne(
      { _id: id },
      { $set: { status: 'terminated', terminationDate } },
      { session: sess(tx) },
    );
  }
  async unsetUserId(id: Id, tx: Tx): Promise<void> {
    await Employee.updateOne({ _id: id }, { $unset: { userId: '' } }, { session: sess(tx) });
  }
  async detachManager(managerId: Id, tx: Tx): Promise<void> {
    await Employee.updateMany(
      { managerId: new Types.ObjectId(managerId) },
      { $unset: { managerId: '' } },
      { session: sess(tx) },
    );
  }
}

function buildFilter(f: ListEmployeesFilter): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.departmentId && Types.ObjectId.isValid(f.departmentId)) {
    out.departmentId = new Types.ObjectId(f.departmentId);
  }
  if (f.status) {
    const values = f.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (values.length === 1) out.status = values[0];
    else if (values.length > 1) out.status = { $in: values };
  }
  if (f.employeeType) out.employeeType = f.employeeType;
  if (f.managerId && Types.ObjectId.isValid(f.managerId)) {
    out.managerId = new Types.ObjectId(f.managerId);
  }
  return out;
}

function buildSearchMatch(q?: string): Record<string, unknown> | null {
  if (!q || !q.trim()) return null;
  const rx = { $regex: q.trim(), $options: 'i' };
  return {
    $or: [
      { employeeCode: rx },
      { fingerprintId: rx },
      { 'profile.firstName': rx },
      { 'profile.middleName': rx },
      { 'profile.lastName': rx },
      { 'profile.email': rx },
      { 'profile.workEmail': rx },
      { 'position.title': rx },
    ],
  };
}

export class MongooseEmployeeProfileRepository implements EmployeeProfileRepository {
  async findByEmployeeId(employeeId: Id): Promise<Doc | null> {
    if (!valid(employeeId)) return null;
    return json(await EmployeeProfile.findOne({ employeeId }));
  }
  async create(employeeId: Id, data: Record<string, unknown>, tx: Tx): Promise<void> {
    await EmployeeProfile.create([{ employeeId: new Types.ObjectId(employeeId), ...data }], { session: sess(tx) });
  }
  async upsertByEmployeeId(employeeId: Id, patch: Record<string, unknown>): Promise<Doc> {
    const doc = await EmployeeProfile.findOneAndUpdate(
      { employeeId: new Types.ObjectId(employeeId) },
      { $set: patch },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    return doc.toJSON() as Doc;
  }
  async findEmail(employeeId: Id): Promise<{ exists: boolean; email: string | null }> {
    const p = await EmployeeProfile.findOne({ employeeId }).select('email').lean();
    if (!p) return { exists: false, email: null };
    return { exists: true, email: (p as { email?: string }).email ?? null };
  }
  async updateEmail(employeeId: Id, email: string): Promise<void> {
    await EmployeeProfile.updateOne({ employeeId: new Types.ObjectId(employeeId) }, { $set: { email } });
  }
}

export class MongooseContactRepository implements ContactRepository {
  async listByEmployee(employeeId: Id): Promise<Doc[]> {
    if (!valid(employeeId)) return [];
    return EmployeeContact.find({ employeeId }).sort({ isPrimary: -1, created_at: -1 }).lean() as Promise<Doc[]>;
  }
  async create(employeeId: Id, input: Record<string, unknown>): Promise<Doc> {
    const doc = await EmployeeContact.create({ ...input, employeeId: new Types.ObjectId(employeeId) });
    return doc.toJSON() as Doc;
  }
  async updateById(employeeId: Id, id: Id, patch: Record<string, unknown>): Promise<Doc | null> {
    if (!valid(id) || !valid(employeeId)) return null;
    return json(await EmployeeContact.findOneAndUpdate({ _id: id, employeeId }, patch, { new: true }));
  }
  async deleteById(employeeId: Id, id: Id): Promise<boolean> {
    if (!valid(id) || !valid(employeeId)) return false;
    return !!(await EmployeeContact.findOneAndDelete({ _id: id, employeeId }));
  }
  async clearPrimary(employeeId: Id): Promise<void> {
    await EmployeeContact.updateMany(
      { employeeId: new Types.ObjectId(employeeId), isPrimary: true },
      { $set: { isPrimary: false } },
    );
  }
}

export class MongooseBankAccountRepository implements BankAccountRepository {
  async listByEmployee(employeeId: Id): Promise<Doc[]> {
    if (!valid(employeeId)) return [];
    return EmployeeBankAccount.find({ employeeId })
      .sort({ isPrimary: -1, created_at: -1 })
      .lean() as Promise<Doc[]>;
  }
  async create(employeeId: Id, input: Record<string, unknown>): Promise<Doc> {
    const doc = await EmployeeBankAccount.create({ ...input, employeeId: new Types.ObjectId(employeeId) });
    return doc.toJSON() as Doc;
  }
  async updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null> {
    if (!valid(id)) return null;
    return json(await EmployeeBankAccount.findByIdAndUpdate(id, patch, { new: true }));
  }
  async deleteById(id: Id): Promise<boolean> {
    if (!valid(id)) return false;
    return !!(await EmployeeBankAccount.findByIdAndDelete(id));
  }
  async clearPrimary(employeeId: Id): Promise<void> {
    await EmployeeBankAccount.updateMany(
      { employeeId: new Types.ObjectId(employeeId), isPrimary: true },
      { $set: { isPrimary: false } },
    );
  }
}

export class MongooseDocumentRepository implements DocumentRepository {
  async listByEmployee(employeeId: Id): Promise<Doc[]> {
    if (!valid(employeeId)) return [];
    return EmployeeDocumentModel.find({ employeeId }).sort({ created_at: -1 }).lean() as Promise<Doc[]>;
  }
  async create(employeeId: Id, input: Record<string, unknown>): Promise<Doc> {
    const doc = await EmployeeDocumentModel.create({ ...input, employeeId: new Types.ObjectId(employeeId) });
    return doc.toJSON() as Doc;
  }
  async updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null> {
    if (!valid(id)) return null;
    return json(await EmployeeDocumentModel.findByIdAndUpdate(id, patch, { new: true }));
  }
  async deleteById(id: Id): Promise<boolean> {
    if (!valid(id)) return false;
    return !!(await EmployeeDocumentModel.findByIdAndDelete(id));
  }
}

export class MongooseAssetRepository implements AssetRepository {
  async listByEmployee(employeeId: Id): Promise<Doc[]> {
    if (!valid(employeeId)) return [];
    return EmployeeAsset.find({ employeeId }).sort({ assignedDate: -1 }).lean() as Promise<Doc[]>;
  }
  async create(employeeId: Id, input: Record<string, unknown>): Promise<Doc> {
    const doc = await EmployeeAsset.create({ ...input, employeeId: new Types.ObjectId(employeeId) });
    return doc.toJSON() as Doc;
  }
  async markReturned(id: Id, patch: Record<string, unknown>): Promise<Doc | null> {
    if (!valid(id)) return null;
    return json(await EmployeeAsset.findByIdAndUpdate(id, patch, { new: true }));
  }
  async updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null> {
    if (!valid(id)) return null;
    return json(await EmployeeAsset.findByIdAndUpdate(id, patch, { new: true }));
  }
  async deleteById(id: Id): Promise<boolean> {
    if (!valid(id)) return false;
    return !!(await EmployeeAsset.findByIdAndDelete(id));
  }
}

export class MongooseContractRepository implements ContractRepository {
  async listByEmployee(employeeId: Id): Promise<Doc[]> {
    if (!valid(employeeId)) return [];
    const rows = await EmployeeContractModel.find({ employeeId }).sort({ startDate: -1 }).lean();
    return rows.map((r) => ({ ...r, baseSalary: r.baseSalary != null ? String(r.baseSalary) : '0' })) as Doc[];
  }
  async findByNumber(contractNumber: string): Promise<Doc | null> {
    return (await EmployeeContractModel.findOne({ contractNumber })) as unknown as Doc | null;
  }
  async employeeIdOf(contractId: Id): Promise<string | null> {
    if (!valid(contractId)) return null;
    const c = await EmployeeContractModel.findById(contractId).select('employeeId').lean();
    return c ? String((c as { employeeId: unknown }).employeeId) : null;
  }
  async expireActive(employeeId: Id, tx: Tx): Promise<void> {
    await EmployeeContractModel.updateMany(
      { employeeId: new Types.ObjectId(employeeId), status: 'active' },
      { $set: { status: 'expired' } },
      { session: sess(tx) },
    );
  }
  async expireActiveExcept(employeeId: Id, exceptContractId: Id): Promise<void> {
    await EmployeeContractModel.updateMany(
      { employeeId: new Types.ObjectId(employeeId), status: 'active', _id: { $ne: new Types.ObjectId(exceptContractId) } },
      { $set: { status: 'expired' } },
    );
  }
  async create(employeeId: Id, input: Record<string, unknown>, tx: Tx): Promise<Doc> {
    const [contract] = await EmployeeContractModel.create(
      [
        {
          ...input,
          employeeId: new Types.ObjectId(employeeId),
          baseSalary: mongoose.Types.Decimal128.fromString(String(input.baseSalary)),
        },
      ] as any[],
      { session: sess(tx) },
    );
    return contract!.toJSON() as Doc;
  }
  async updateById(id: Id, patch: Record<string, unknown>): Promise<Doc | null> {
    if (!valid(id)) return null;
    const p: Record<string, unknown> = { ...patch };
    if (p.baseSalary !== undefined) {
      p.baseSalary = mongoose.Types.Decimal128.fromString(String(p.baseSalary));
    }
    return json(await EmployeeContractModel.findByIdAndUpdate(id, p, { new: true }));
  }
}

export class MongooseHistoryRepository implements HistoryRepository {
  async listByEmployee(employeeId: Id): Promise<Doc[]> {
    if (!valid(employeeId)) return [];
    return EmployeeHistory.find({ employeeId }).sort({ effectiveDate: -1 }).lean() as Promise<Doc[]>;
  }
  async create(
    data: {
      employeeId: Id;
      eventType: string;
      fromValue?: Record<string, unknown>;
      toValue?: Record<string, unknown>;
      effectiveDate: Date;
      note?: string;
      createdBy: string | null;
    },
    tx?: Tx,
  ): Promise<void> {
    await EmployeeHistory.create(
      [
        {
          employeeId: new Types.ObjectId(data.employeeId),
          eventType: data.eventType,
          fromValue: data.fromValue,
          toValue: data.toValue,
          effectiveDate: data.effectiveDate,
          note: data.note,
          createdBy: data.createdBy ? new Types.ObjectId(data.createdBy) : null,
        },
      ] as any[],
      { session: sess(tx) },
    );
  }
}
