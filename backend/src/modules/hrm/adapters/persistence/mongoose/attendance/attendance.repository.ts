import { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { Attendance } from '@modules/hrm/adapters/persistence/mongoose/models/attendance.model';
import { Employee } from '@modules/hrm/adapters/persistence/mongoose/models/employee.model';
import type {
  AttendanceRepository,
  AttendanceRecord,
  RosterRow,
  PersistedAttendanceFields,
  Id,
  Tx,
} from '@modules/hrm/core/attendance/domain/ports';

const oid = (id: Id) => new Types.ObjectId(id);
const sess = (tx?: Tx): ClientSession | undefined => tx as ClientSession | undefined;

/** Map a lean/JSON attendance doc to the record read-model (ids as strings).
 *  Spreads the full doc so HTTP responses keep every field. */
function toRecord(doc: unknown): AttendanceRecord | null {
  if (!doc) return null;
  const d = doc as Record<string, unknown>;
  return {
    ...d,
    _id: String(d._id),
    employeeId: d.employeeId ? String(d.employeeId) : d.employeeId,
    shiftId: d.shiftId ? String(d.shiftId) : null,
    leaveRequestId: d.leaveRequestId ? String(d.leaveRequestId) : null,
  } as AttendanceRecord;
}

export class MongooseAttendanceRepository implements AttendanceRepository {
  async findByEmployeeAndRange(employeeId: Id, start: Date, end: Date): Promise<AttendanceRecord[]> {
    const rows = await Attendance.find({ employeeId: oid(employeeId), date: { $gte: start, $lt: end } })
      .sort({ date: 1 })
      .lean();
    return rows.map((r) => toRecord(r)!);
  }

  async findForRoster(employeeIds: Id[], start: Date, end: Date): Promise<AttendanceRecord[]> {
    const rows = await Attendance.find({
      employeeId: { $in: employeeIds.map(oid) },
      date: { $gte: start, $lt: end },
    }).lean();
    return rows.map((r) => toRecord(r)!);
  }

  async findFullDayLeave(employeeId: Id, date: Date): Promise<AttendanceRecord | null> {
    const r = await Attendance.findOne({
      employeeId: oid(employeeId),
      date,
      source: 'leave',
      session: 'full_day',
    }).lean();
    return toRecord(r);
  }

  async findBySlot(employeeId: Id, date: Date, shiftId: Id): Promise<AttendanceRecord | null> {
    const r = await Attendance.findOne({ employeeId: oid(employeeId), date, shiftId: oid(shiftId) }).lean();
    return toRecord(r);
  }

  async findById(id: Id): Promise<AttendanceRecord | null> {
    const r = await Attendance.findById(id).lean();
    return toRecord(r);
  }

  async upsertPunch(
    slot: { employeeId: Id; date: Date; shiftId: Id },
    fields: PersistedAttendanceFields & { source: string },
    createdBy: Id,
  ): Promise<AttendanceRecord> {
    const doc = await Attendance.findOneAndUpdate(
      { employeeId: oid(slot.employeeId), date: slot.date, shiftId: oid(slot.shiftId) },
      {
        $set: {
          checkIn: fields.checkIn,
          checkOut: fields.checkOut,
          status: fields.status,
          workHours: fields.workHours,
          lateMinutes: fields.lateMinutes,
          earlyMinutes: fields.earlyMinutes,
          session: fields.session,
          source: fields.source,
        },
        $setOnInsert: { createdBy: oid(createdBy) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return toRecord(doc!.toJSON())!;
  }

  async createManual(
    data: { employeeId: Id; date: Date; shiftId: Id; note: string | null; source: string; createdBy: Id } & PersistedAttendanceFields,
  ): Promise<AttendanceRecord> {
    const created = await Attendance.create({
      employeeId: oid(data.employeeId),
      date: data.date,
      shiftId: oid(data.shiftId),
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      status: data.status,
      workHours: data.workHours,
      lateMinutes: data.lateMinutes,
      earlyMinutes: data.earlyMinutes,
      session: data.session,
      note: data.note,
      source: data.source,
      createdBy: oid(data.createdBy),
    });
    return toRecord(created.toJSON())!;
  }

  async updateById(
    id: Id,
    data: Partial<PersistedAttendanceFields> & { shiftId?: Id; note?: string | null; adjustedBy?: Id; adjustedAt?: Date },
  ): Promise<AttendanceRecord | null> {
    const record = await Attendance.findById(id);
    if (!record) return null;
    const patch: Record<string, unknown> = { ...data };
    if (data.shiftId) patch.shiftId = oid(data.shiftId);
    if (data.adjustedBy) patch.adjustedBy = oid(data.adjustedBy);
    Object.assign(record, patch);
    await record.save();
    return toRecord(record.toJSON());
  }

  async deleteById(id: Id): Promise<boolean> {
    const deleted = await Attendance.findByIdAndDelete(id);
    return !!deleted;
  }

  async supersedeDay(employeeId: Id, date: Date, exceptLeaveId: Id, tx: Tx): Promise<void> {
    await Attendance.deleteMany(
      { employeeId: oid(employeeId), date, leaveRequestId: { $ne: oid(exceptLeaveId) } },
      { session: sess(tx) },
    );
  }

  async upsertLeaveRow(
    employeeId: Id,
    date: Date,
    leaveRequestId: Id,
    fields: { session: string; status: string; source: string; createdBy: Id | null },
    tx: Tx,
  ): Promise<void> {
    await Attendance.updateOne(
      { employeeId: oid(employeeId), date, leaveRequestId: oid(leaveRequestId) },
      {
        $set: {
          session: fields.session,
          shiftId: null,
          status: fields.status,
          workHours: 0,
          lateMinutes: 0,
          earlyMinutes: 0,
          source: fields.source,
          createdBy: fields.createdBy ? oid(fields.createdBy) : null,
        },
      },
      { upsert: true, session: sess(tx) },
    );
  }

  async deleteByLeaveRequest(leaveRequestId: Id, tx?: Tx): Promise<void> {
    await Attendance.deleteMany({ leaveRequestId: oid(leaveRequestId) }, { session: sess(tx) });
  }

  async roster(filter: { departmentId?: string; q?: string }): Promise<RosterRow[]> {
    const match: Record<string, unknown> = { status: { $ne: 'terminated' } };
    if (filter.departmentId && Types.ObjectId.isValid(filter.departmentId)) {
      match.departmentId = new Types.ObjectId(filter.departmentId);
    }
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: 'employeeProfiles', localField: '_id', foreignField: 'employeeId', as: 'profile' } },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'department' } },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          employeeCode: 1,
          hireDate: 1,
          departmentName: { $ifNull: ['$department.name', ''] },
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
    ];
    if (filter.q?.trim()) {
      const rx = { $regex: filter.q.trim(), $options: 'i' };
      pipeline.push({ $match: { $or: [{ employeeCode: rx }, { fullName: rx }] } });
    }
    pipeline.push({ $sort: { employeeCode: 1 } });
    const rows = await Employee.aggregate(pipeline);
    return rows.map((r) => ({ ...r, _id: String(r._id) })) as RosterRow[];
  }
}
