import { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { LeaveRequest, type LeaveType } from '@modules/hrm/adapters/persistence/mongoose/models/leave-request.model';
import { LeaveBalance } from '@modules/hrm/adapters/persistence/mongoose/models/leave-balance.model';
import type {
  LeaveRequestRepository,
  LeaveBalanceRepository,
  LeaveRequestRecord,
  LeaveBalanceRecord,
  Id,
  Tx,
} from '@modules/hrm/core/attendance/domain/ports';

const oid = (id: Id) => new Types.ObjectId(id);
const sess = (tx?: Tx): ClientSession | undefined => tx as ClientSession | undefined;
const qSess = (tx?: Tx): ClientSession | null => (tx as ClientSession | undefined) ?? null;

function toLeave(doc: unknown): LeaveRequestRecord | null {
  if (!doc) return null;
  const d = doc as Record<string, unknown>;
  return {
    ...d,
    _id: String(d._id),
    employeeId: String(d.employeeId),
    approverId: d.approverId ? String(d.approverId) : null,
    createdBy: d.createdBy ? String(d.createdBy) : null,
  } as LeaveRequestRecord;
}

function toBalance(doc: unknown): LeaveBalanceRecord | null {
  if (!doc) return null;
  const d = doc as Record<string, unknown>;
  return { ...d, _id: String(d._id), employeeId: String(d.employeeId) } as LeaveBalanceRecord;
}

// Aggregation joining employee + profile for the admin list (name + code).
function withEmployeePipeline(match: Record<string, unknown>): PipelineStage[] {
  return [
    { $match: match },
    { $sort: { created_at: -1 } },
    { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' } },
    { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'employeeProfiles', localField: 'employeeId', foreignField: 'employeeId', as: 'profile' } },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        employeeCode: '$employee.employeeCode',
        fullName: {
          $trim: {
            input: {
              $reduce: {
                input: [
                  { $ifNull: ['$profile.lastName', ''] },
                  { $ifNull: ['$profile.middleName', ''] },
                  { $ifNull: ['$profile.firstName', ''] },
                ],
                initialValue: '',
                in: { $concat: ['$$value', ' ', '$$this'] },
              },
            },
          },
        },
      },
    },
    { $project: { employee: 0, profile: 0 } },
  ];
}

export class MongooseLeaveRequestRepository implements LeaveRequestRepository {
  async create(data: {
    employeeId: Id; leaveType: LeaveType; startDate: Date; endDate: Date; days: number;
    halfDaySession: string | null; reason: string | null; createdBy: Id;
  }): Promise<LeaveRequestRecord> {
    const doc = await LeaveRequest.create({
      employeeId: oid(data.employeeId),
      leaveType: data.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      days: data.days,
      halfDaySession: data.halfDaySession as 'morning' | 'afternoon' | null,
      reason: data.reason,
      status: 'pending',
      createdBy: oid(data.createdBy),
    });
    return toLeave(doc.toJSON())!;
  }

  async findById(id: Id, tx?: Tx): Promise<LeaveRequestRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await LeaveRequest.findById(id).session(qSess(tx)).lean();
    return toLeave(doc);
  }

  async findByEmployee(employeeId: Id): Promise<LeaveRequestRecord[]> {
    const rows = await LeaveRequest.find({ employeeId: oid(employeeId) }).sort({ created_at: -1 }).lean();
    return rows.map((r) => toLeave(r)!);
  }

  listWithEmployee(filter: { status?: string }): Promise<Record<string, unknown>[]> {
    const match: Record<string, unknown> = {};
    if (filter.status) match.status = filter.status;
    return LeaveRequest.aggregate(withEmployeePipeline(match));
  }

  async updateStatus(
    id: Id,
    patch: Partial<Pick<LeaveRequestRecord, 'status' | 'approverId' | 'approvedAt' | 'rejectionReason'>>,
    tx?: Tx,
  ): Promise<LeaveRequestRecord | null> {
    const set: Record<string, unknown> = { ...patch };
    if (patch.approverId) set.approverId = oid(patch.approverId);
    const doc = await LeaveRequest.findByIdAndUpdate(id, { $set: set }, { new: true }).session(qSess(tx)).lean();
    return toLeave(doc);
  }
}

export class MongooseLeaveBalanceRepository implements LeaveBalanceRepository {
  async findInYearWindow(employeeId: Id, from: number, to: number, tx?: Tx): Promise<LeaveBalanceRecord[]> {
    const rows = await LeaveBalance.find({
      employeeId: oid(employeeId),
      leaveType: 'annual',
      year: { $gte: from, $lte: to },
    })
      .session(qSess(tx))
      .lean();
    return rows.map((r) => toBalance(r)!);
  }

  async findOne(employeeId: Id, leaveType: string, year: number, tx?: Tx): Promise<LeaveBalanceRecord | null> {
    const doc = await LeaveBalance.findOne({ employeeId: oid(employeeId), leaveType: leaveType as LeaveType, year }).session(qSess(tx)).lean();
    return toBalance(doc);
  }

  async ensureEntitlement(employeeId: Id, year: number, entitled: number, tx?: Tx): Promise<void> {
    await LeaveBalance.updateOne(
      { employeeId: oid(employeeId), leaveType: 'annual', year },
      { $setOnInsert: { entitled, used: 0 } },
      { upsert: true, session: sess(tx) },
    );
  }

  async incrementUsed(employeeId: Id, leaveType: string, year: number, delta: number, tx: Tx): Promise<void> {
    await LeaveBalance.updateOne(
      { employeeId: oid(employeeId), leaveType: leaveType as LeaveType, year },
      { $inc: { used: delta }, $setOnInsert: { entitled: 0 } },
      { upsert: true, session: sess(tx) },
    );
  }

  async setUsed(id: Id, used: number, tx: Tx): Promise<void> {
    await LeaveBalance.updateOne({ _id: oid(id) }, { $set: { used } }, { session: sess(tx) });
  }

  async upsertEntitled(employeeId: Id, leaveType: string, year: number, entitled: number): Promise<LeaveBalanceRecord> {
    const updated = await LeaveBalance.findOneAndUpdate(
      { employeeId: oid(employeeId), leaveType: leaveType as LeaveType, year },
      { $set: { entitled }, $setOnInsert: { used: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return toBalance(updated)!;
  }

  async findByEmployeeYear(employeeId: Id, year: number): Promise<LeaveBalanceRecord[]> {
    const rows = await LeaveBalance.find({ employeeId: oid(employeeId), year }).lean();
    return rows.map((r) => toBalance(r)!);
  }
}
