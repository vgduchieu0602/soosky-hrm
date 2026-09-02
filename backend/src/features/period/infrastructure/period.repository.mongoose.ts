import mongoose, { Types } from 'mongoose';
import { PayrollPeriod } from './period.schema';
import type { PeriodRepository, PeriodRecord, Id, Tx } from '../domain/ports';
import type { CreatePeriodDto, UpdatePeriodDto } from '@modules/hrm/core/period/dto/period.dto';

const valid = (id: string) => Types.ObjectId.isValid(id);
const session = (tx: Tx) => tx as mongoose.ClientSession;

export class MongoosePeriodRepository implements PeriodRepository {
  list() {
    return PayrollPeriod.find().sort({ startDate: -1 }).lean() as unknown as Promise<PeriodRecord[]>;
  }

  async findById(id: Id) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findById(id);
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }

  findByName(name: string) {
    return PayrollPeriod.findOne({ name: name.trim() }).lean() as unknown as Promise<PeriodRecord | null>;
  }

  findLatest() {
    return PayrollPeriod.findOne().sort({ startDate: -1 }).lean() as unknown as Promise<PeriodRecord | null>;
  }

  namesByIds(ids: Id[]) {
    return PayrollPeriod.find({ _id: { $in: ids } })
      .select('name')
      .lean() as unknown as Promise<{ _id: unknown; name: string }[]>;
  }

  async create(input: CreatePeriodDto & { standardWorkDays: number }) {
    const doc = await PayrollPeriod.create(input);
    return doc.toJSON() as unknown as PeriodRecord;
  }

  async update(id: Id, patch: UpdatePeriodDto) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findByIdAndUpdate(id, patch, { new: true });
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }

  async delete(id: Id) {
    if (!valid(id)) return;
    await PayrollPeriod.findByIdAndDelete(id);
  }

  async markProcessing(id: Id, tx: Tx) {
    if (!valid(id)) return;
    await PayrollPeriod.findByIdAndUpdate(id, { status: 'processing' }, session(tx) ? { session: session(tx) } : {});
  }

  async markPaid(id: Id, tx: Tx) {
    if (!valid(id)) return;
    await PayrollPeriod.findByIdAndUpdate(id, { status: 'paid' }, session(tx) ? { session: session(tx) } : {});
  }

  async markClosed(id: Id, byUserId: Id) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findByIdAndUpdate(
      id,
      { status: 'closed', closedAt: new Date(), closedBy: new Types.ObjectId(byUserId) },
      { new: true },
    );
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }

  async reopenToOpen(id: Id) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findByIdAndUpdate(id, { status: 'open', closedAt: null, closedBy: null }, { new: true });
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }

  async lockAttendance(id: Id, byUserId: Id) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findByIdAndUpdate(
      id,
      { attendanceLockedAt: new Date(), attendanceLockedBy: new Types.ObjectId(byUserId) },
      { new: true },
    );
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }

  async unlockAttendance(id: Id) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findByIdAndUpdate(id, { attendanceLockedAt: null, attendanceLockedBy: null }, { new: true });
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }

  async lockPerformance(id: Id, byUserId: Id) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findByIdAndUpdate(
      id,
      { performanceLockedAt: new Date(), performanceLockedBy: new Types.ObjectId(byUserId) },
      { new: true },
    );
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }

  async unlockPerformance(id: Id) {
    if (!valid(id)) return null;
    const doc = await PayrollPeriod.findByIdAndUpdate(id, { performanceLockedAt: null, performanceLockedBy: null }, { new: true });
    return doc ? (doc.toJSON() as unknown as PeriodRecord) : null;
  }
}
