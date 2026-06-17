import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Attendance } from '@shared/models/attendance.model';
import { Shift } from '@shared/models/shift.model';
import { Employee } from '@shared/models/employee.model';
import { CompanyConfig } from '@shared/models/company-config.model';
import { auditService } from '@features/iam/services/audit.service';
import {
  computeAttendance,
  vnDateKey,
  vnMonthRange,
  DEFAULT_POLICY,
  type AttendancePolicy,
  type ShiftWindow,
} from '@features/attendance/services/attendance-calc';
import { rosterForGrid } from '@features/attendance/repositories/attendance.repository';
import type {
  UpsertAttendanceDto,
  AdjustAttendanceDto,
} from '@features/attendance/dto/attendance.dto';

const log = logger.child({ feature: 'attendance', module: 'attendance' });

const MANUAL_STATUSES = ['leave_paid', 'leave_unpaid', 'holiday', 'absent'] as const;

/** Attendance policy (timezone + grace) from CompanyConfig, set by Admin/HR. */
async function loadPolicy(): Promise<AttendancePolicy> {
  const cfg = await CompanyConfig.findOne({ key: 'global' }).lean();
  if (!cfg) return DEFAULT_POLICY;
  return {
    timezone: cfg.timezone || DEFAULT_POLICY.timezone,
    graceLateMin: cfg.graceLateMinutes ?? DEFAULT_POLICY.graceLateMin,
    graceEarlyMin: cfg.graceEarlyMinutes ?? DEFAULT_POLICY.graceEarlyMin,
  };
}

async function shiftWindow(shiftId: string): Promise<ShiftWindow> {
  if (!Types.ObjectId.isValid(shiftId)) {
    throw new HttpError(400, 'Ca làm không hợp lệ', 'ATT_005');
  }
  const s = await Shift.findById(shiftId).lean();
  if (!s) throw new HttpError(404, 'Không tìm thấy ca làm', 'ATT_005');
  return { startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes };
}

function computeFields(
  window: ShiftWindow,
  policy: AttendancePolicy,
  input: { status?: string; checkIn?: Date | null; checkOut?: Date | null },
) {
  if (input.status && (MANUAL_STATUSES as readonly string[]).includes(input.status)) {
    return {
      status: input.status as (typeof MANUAL_STATUSES)[number],
      workHours: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      checkIn: null as Date | null,
      checkOut: null as Date | null,
    };
  }
  const r = computeAttendance({ shift: window, checkIn: input.checkIn, checkOut: input.checkOut, policy });
  return { ...r, checkIn: input.checkIn ?? null, checkOut: input.checkOut ?? null };
}

export const attendanceService = {
  /** Employee self view — derives employee from the authenticated user. */
  async myMonth(userId: string, month: string) {
    const employee = await Employee.findOne({ userId });
    if (!employee) throw new HttpError(404, 'Không tìm thấy hồ sơ nhân viên', 'EMP_001');
    const { start, end } = vnMonthRange(month);
    const records = await Attendance.find({
      employeeId: employee._id,
      date: { $gte: start, $lt: end },
    })
      .sort({ date: 1 })
      .lean();
    return { employeeId: employee._id.toString(), month, records };
  },

  /** Admin/HR grid: roster + active shifts (ca) + their records for the month. */
  async adminGrid(query: { month: string; departmentId?: string; q?: string }) {
    const [roster, shifts] = await Promise.all([
      rosterForGrid({ departmentId: query.departmentId, q: query.q }),
      Shift.find({ status: 'active' }).sort({ startTime: 1 }).lean(),
    ]);
    const { start, end } = vnMonthRange(query.month);
    const ids = roster.map((r) => r._id);
    const records = await Attendance.find({
      employeeId: { $in: ids },
      date: { $gte: start, $lt: end },
    }).lean();
    return { month: query.month, employees: roster, shifts, records };
  },

  /** Create or update the record for {employee, date, shift (ca)}. */
  async upsert(input: UpsertAttendanceDto, userId: string) {
    if (!Types.ObjectId.isValid(input.employeeId)) {
      throw new HttpError(400, 'employeeId không hợp lệ', 'ATT_004');
    }
    const employee = await Employee.findById(input.employeeId).lean();
    if (!employee) throw new HttpError(404, 'Không tìm thấy nhân viên', 'EMP_001');

    const policy = await loadPolicy();
    const window = await shiftWindow(input.shiftId);
    const shiftObjId = new Types.ObjectId(input.shiftId);
    const dateKey = vnDateKey(input.date, policy.timezone);
    const fields = computeFields(window, policy, input);

    const existing = await Attendance.findOne({
      employeeId: employee._id,
      date: dateKey,
      shiftId: shiftObjId,
    });

    if (existing) {
      Object.assign(existing, {
        checkIn: fields.checkIn,
        checkOut: fields.checkOut,
        status: fields.status,
        workHours: fields.workHours,
        lateMinutes: fields.lateMinutes,
        earlyMinutes: fields.earlyMinutes,
        note: input.note ?? existing.note,
        adjustedBy: new Types.ObjectId(userId),
        adjustedAt: new Date(),
      });
      await existing.save();
      await auditService.record({
        userId,
        resource: 'attendance',
        action: 'update',
        resourceId: existing._id.toString(),
        changes: { status: fields.status },
      });
      return existing.toJSON();
    }

    const created = await Attendance.create({
      employeeId: employee._id,
      date: dateKey,
      shiftId: shiftObjId,
      checkIn: fields.checkIn,
      checkOut: fields.checkOut,
      status: fields.status,
      workHours: fields.workHours,
      lateMinutes: fields.lateMinutes,
      earlyMinutes: fields.earlyMinutes,
      note: input.note ?? null,
      source: 'manual',
      createdBy: new Types.ObjectId(userId),
    });
    await auditService.record({
      userId,
      resource: 'attendance',
      action: 'create',
      resourceId: created._id.toString(),
      changes: { status: fields.status },
    });
    return created.toJSON();
  },

  async bulkUpsert(rows: UpsertAttendanceDto[], userId: string) {
    const results = [];
    for (const row of rows) results.push(await this.upsert(row, userId));
    return { count: results.length };
  },

  /** Edit an existing record by id (HR correction, audited with reason). */
  async adjust(id: string, input: AdjustAttendanceDto, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    const record = await Attendance.findById(id);
    if (!record) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');

    const policy = await loadPolicy();
    const shiftId = input.shiftId ?? record.shiftId?.toString();
    if (!shiftId) throw new HttpError(400, 'Thiếu ca làm', 'ATT_005');
    const window = await shiftWindow(shiftId);

    const checkIn = input.checkIn !== undefined ? input.checkIn : record.checkIn;
    const checkOut = input.checkOut !== undefined ? input.checkOut : record.checkOut;
    const fields = computeFields(window, policy, { status: input.status, checkIn, checkOut });

    Object.assign(record, {
      shiftId: new Types.ObjectId(shiftId),
      checkIn: fields.checkIn,
      checkOut: fields.checkOut,
      status: fields.status,
      workHours: fields.workHours,
      lateMinutes: fields.lateMinutes,
      earlyMinutes: fields.earlyMinutes,
      note: input.note !== undefined ? input.note : record.note,
      adjustedBy: new Types.ObjectId(userId),
      adjustedAt: new Date(),
    });
    await record.save();
    await auditService.record({
      userId,
      resource: 'attendance',
      action: 'update',
      resourceId: record._id.toString(),
      changes: { status: fields.status, reason: input.reason ?? null },
    });
    return record.toJSON();
  },

  /** Delete one ca record (HR clears a ca). */
  async remove(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    const deleted = await Attendance.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    await auditService.record({ userId, resource: 'attendance', action: 'delete', resourceId: id });
    return { id, deleted: true };
  },
};
