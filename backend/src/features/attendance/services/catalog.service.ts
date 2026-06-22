import { Types } from 'mongoose';
import { HttpError } from '@shared/errors/http-error';
import { Shift } from '@shared/models/shift.model';
import { Holiday } from '@shared/models/holiday.model';
import { AttendanceSymbol } from '@shared/models/attendance-symbol.model';
import { auditService } from '@features/iam/services/audit.service';

function oid(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Not found', 'ATT_001');
  return id;
}

export const shiftService = {
  list() {
    return Shift.find({}).sort({ status: 1, name: 1 }).lean();
  },
  async create(input: Record<string, unknown>, userId: string) {
    const doc = await Shift.create(input);
    await auditService.record({ userId, resource: 'shift', action: 'create', resourceId: doc._id.toString() });
    return doc.toJSON();
  },
  async update(id: string, input: Record<string, unknown>, userId: string) {
    const updated = await Shift.findByIdAndUpdate(oid(id), input, { new: true });
    if (!updated) throw new HttpError(404, 'Shift not found', 'ATT_001');
    await auditService.record({ userId, resource: 'shift', action: 'update', resourceId: id, changes: input });
    return updated.toJSON();
  },
  // Soft-remove a ca (archive) — keeps it referenced by historical records.
  async remove(id: string, userId: string) {
    const updated = await Shift.findByIdAndUpdate(oid(id), { status: 'archived' }, { new: true });
    if (!updated) throw new HttpError(404, 'Shift not found', 'ATT_001');
    await auditService.record({ userId, resource: 'shift', action: 'delete', resourceId: id });
    return { id };
  },
};

export const holidayService = {
  list() {
    return Holiday.find({}).sort({ date: 1 }).lean();
  },
  async create(input: Record<string, unknown>, userId: string) {
    const doc = await Holiday.create(input);
    await auditService.record({ userId, resource: 'holiday', action: 'create', resourceId: doc._id.toString() });
    return doc.toJSON();
  },
  async update(id: string, input: Record<string, unknown>, userId: string) {
    const updated = await Holiday.findByIdAndUpdate(oid(id), input, { new: true });
    if (!updated) throw new HttpError(404, 'Holiday not found', 'ATT_002');
    await auditService.record({ userId, resource: 'holiday', action: 'update', resourceId: id, changes: input });
    return updated.toJSON();
  },
  async remove(id: string, userId: string) {
    const deleted = await Holiday.findByIdAndDelete(oid(id));
    if (!deleted) throw new HttpError(404, 'Holiday not found', 'ATT_002');
    await auditService.record({ userId, resource: 'holiday', action: 'delete', resourceId: id });
    return { id };
  },
};

export const symbolService = {
  list() {
    return AttendanceSymbol.find({}).sort({ code: 1 }).lean();
  },
  async create(input: { code: string } & Record<string, unknown>, userId: string) {
    const dup = await AttendanceSymbol.findOne({ code: input.code.trim() });
    if (dup) throw new HttpError(409, 'Symbol code already exists', 'ATT_003');
    const doc = await AttendanceSymbol.create(input);
    await auditService.record({ userId, resource: 'attendanceSymbol', action: 'create', resourceId: doc._id.toString() });
    return doc.toJSON();
  },
  async update(id: string, input: Record<string, unknown>, userId: string) {
    const updated = await AttendanceSymbol.findByIdAndUpdate(oid(id), input, { new: true });
    if (!updated) throw new HttpError(404, 'Symbol not found', 'ATT_003');
    await auditService.record({ userId, resource: 'attendanceSymbol', action: 'update', resourceId: id, changes: input });
    return updated.toJSON();
  },
  async remove(id: string, userId: string) {
    const deleted = await AttendanceSymbol.findByIdAndDelete(oid(id));
    if (!deleted) throw new HttpError(404, 'Symbol not found', 'ATT_003');
    await auditService.record({ userId, resource: 'attendanceSymbol', action: 'delete', resourceId: id });
    return { id };
  },
};
