import { Types } from 'mongoose';
import { Shift } from '@shared/models/shift.model';
import { Holiday } from '@shared/models/holiday.model';
import { AttendanceSymbol } from '@shared/models/attendance-symbol.model';
import type { ShiftRepository, HolidayRepository, SymbolRepository, Id } from '@features/attendance/domain/ports';

const valid = (id: Id) => Types.ObjectId.isValid(id);
const json = (d: { toJSON(): Record<string, unknown> } | null) => (d ? d.toJSON() : null);
const many = (q: unknown) => q as unknown as Promise<Record<string, unknown>[]>;

export class MongooseShiftRepository implements ShiftRepository {
  list() {
    return many(Shift.find({}).sort({ status: 1, name: 1 }).lean());
  }
  async create(input: Record<string, unknown>) {
    return json(await Shift.create(input))!;
  }
  async update(id: Id, input: Record<string, unknown>) {
    if (!valid(id)) return null;
    return json(await Shift.findByIdAndUpdate(id, input, { new: true }));
  }
  async archive(id: Id) {
    if (!valid(id)) return null;
    return json(await Shift.findByIdAndUpdate(id, { status: 'archived' }, { new: true }));
  }
  async remove(id: Id) {
    if (!valid(id)) return false;
    return !!(await Shift.findByIdAndDelete(id));
  }
}

export class MongooseHolidayRepository implements HolidayRepository {
  list() {
    return many(Holiday.find({}).sort({ date: 1 }).lean());
  }
  async create(input: Record<string, unknown>) {
    return json(await Holiday.create(input))!;
  }
  async update(id: Id, input: Record<string, unknown>) {
    if (!valid(id)) return null;
    return json(await Holiday.findByIdAndUpdate(id, input, { new: true }));
  }
  async remove(id: Id) {
    if (!valid(id)) return false;
    return !!(await Holiday.findByIdAndDelete(id));
  }
  async findOverlapping(start: Date, end: Date) {
    return Holiday.find({ $or: [{ date: { $gte: start, $lte: end } }, { isRecurring: true }] })
      .lean() as unknown as { date: Date; isRecurring?: boolean }[];
  }
}

export class MongooseSymbolRepository implements SymbolRepository {
  list() {
    return many(AttendanceSymbol.find({}).sort({ code: 1 }).lean());
  }
  async create(input: Record<string, unknown>) {
    return json(await AttendanceSymbol.create(input))!;
  }
  async update(id: Id, input: Record<string, unknown>) {
    if (!valid(id)) return null;
    return json(await AttendanceSymbol.findByIdAndUpdate(id, input, { new: true }));
  }
  async remove(id: Id) {
    if (!valid(id)) return false;
    return !!(await AttendanceSymbol.findByIdAndDelete(id));
  }
  async findByCode(code: string) {
    return json(await AttendanceSymbol.findOne({ code: code.trim() }));
  }
}
