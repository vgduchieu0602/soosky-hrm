import { Types } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Attendance } from '@shared/models/attendance.model';
import { Shift } from '@shared/models/shift.model';
import { Employee } from '@shared/models/employee.model';
import { CompanyConfig } from '@shared/models/company-config.model';
import { ensureAnnualEntitlement, annualRemaining } from '@features/attendance/services/leave.service';
import { PayrollPeriod } from '@shared/models/payroll-period.model';
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

/** Reject edits when the day falls inside a payroll period whose attendance is locked. */
async function assertAttendanceUnlocked(date: Date): Promise<void> {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const locked = await PayrollPeriod.findOne({
    startDate: { $lte: day },
    endDate: { $gte: day },
    attendanceLockedAt: { $ne: null },
  }).select('name').lean();
  if (locked) {
    throw new HttpError(409, `Kỳ ${locked.name} đã chốt chấm công — không thể sửa`, 'ATT_LOCKED');
  }
}

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

/** Whole months an employee has worked, from hireDate to now (≥ 0). */
function monthsSince(hire?: Date | null, nowMs: number = Date.now()): number {
  if (!hire) return 0;
  const h = new Date(hire);
  const n = new Date(nowMs);
  let m = (n.getFullYear() - h.getFullYear()) * 12 + (n.getMonth() - h.getMonth());
  if (n.getDate() < h.getDate()) m -= 1;
  return Math.max(0, m);
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
      session: 'full_day' as const, // manual leave/holiday/absent = whole day
      checkIn: null as Date | null,
      checkOut: null as Date | null,
    };
  }
  const r = computeAttendance({ shift: window, checkIn: input.checkIn, checkOut: input.checkOut, policy });
  return { ...r, session: r.session ?? 'full_day', checkIn: input.checkIn ?? null, checkOut: input.checkOut ?? null };
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

  /** Employee self check-in / check-out for today against the default shift. */
  async punch(userId: string, kind: 'in' | 'out') {
    const employee = await Employee.findOne({ userId });
    if (!employee) throw new HttpError(404, 'Không tìm thấy hồ sơ nhân viên', 'EMP_001');

    const shift = (await Shift.findOne({ status: 'active', type: 'full_day' }).lean())
      ?? (await Shift.findOne({ status: 'active' }).lean());
    if (!shift) throw new HttpError(400, 'Chưa cấu hình ca làm', 'ATT_005');

    const policy = await loadPolicy();
    const now = new Date();
    const dateKey = vnDateKey(now, policy.timezone);
    await assertAttendanceUnlocked(dateKey);

    // Block punching on a day already covered by an approved full-day leave —
    // otherwise this `present` row coexists with the leave row and payroll
    // counts the day twice.
    const onLeave = await Attendance.findOne({
      employeeId: employee._id,
      date: dateKey,
      source: 'leave',
      session: 'full_day',
    }).select('_id').lean();
    if (onLeave) {
      throw new HttpError(409, 'Bạn đang có đơn nghỉ phép đã duyệt trong ngày này', 'ATT_007');
    }

    const window: ShiftWindow = { startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes };

    const existing = await Attendance.findOne({ employeeId: employee._id, date: dateKey, shiftId: shift._id });
    if (kind === 'out' && !existing?.checkIn) {
      throw new HttpError(409, 'Chưa check-in hôm nay', 'ATT_006');
    }

    const checkIn = kind === 'in' ? now : (existing?.checkIn ?? null);
    const checkOut = kind === 'out' ? now : (existing?.checkOut ?? null);
    const fields = computeFields(window, policy, { checkIn, checkOut });

    const doc = await Attendance.findOneAndUpdate(
      { employeeId: employee._id, date: dateKey, shiftId: shift._id },
      {
        $set: {
          checkIn: fields.checkIn,
          checkOut: fields.checkOut,
          status: fields.status,
          workHours: fields.workHours,
          lateMinutes: fields.lateMinutes,
          earlyMinutes: fields.earlyMinutes,
          session: fields.session, // auto full_day / morning / afternoon from times
          source: 'self',
        },
        $setOnInsert: { createdBy: new Types.ObjectId(userId) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    log.info({ action: `punch-${kind}`, employeeId: employee._id.toString(), status: fields.status });
    return doc!.toJSON();
  },

  /** Admin/HR grid: roster + active shifts (ca) + their records for the month. */
  async adminGrid(query: { month: string; departmentId?: string; q?: string }) {
    const [roster, shifts] = await Promise.all([
      rosterForGrid({ departmentId: query.departmentId, q: query.q }),
      Shift.find({ status: 'active' }).sort({ startTime: 1 }).lean(),
    ]);
    const { start, end } = vnMonthRange(query.month);
    const ids = roster.map((r) => r._id);
    const year = Number(query.month.split('-')[0]);
    const records = await Attendance.find({ employeeId: { $in: ids }, date: { $gte: start, $lt: end } }).lean();

    // Grant official employees this year's annual entitlement (lazily), then
    // compute pooled remaining (current + 2 prior years) = "phép dư".
    const now = Date.now();
    const employees = await Promise.all(
      roster.map(async (r) => {
        await ensureAnnualEntitlement(r._id, year);
        const annualLeaveRemaining = await annualRemaining(r._id, year);
        return { ...r, annualLeaveRemaining, tenureMonths: monthsSince(r.hireDate, now) };
      }),
    );
    return { month: query.month, employees, shifts, records };
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
    await assertAttendanceUnlocked(dateKey);
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
        session: fields.session,
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
      session: fields.session,
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
    await assertAttendanceUnlocked(record.date);

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
    const record = await Attendance.findById(id).select('date').lean();
    if (!record) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    await assertAttendanceUnlocked(record.date);
    const deleted = await Attendance.findByIdAndDelete(id);
    if (!deleted) throw new HttpError(404, 'Không tìm thấy bản ghi', 'ATT_004');
    await auditService.record({ userId, resource: 'attendance', action: 'delete', resourceId: id });
    return { id, deleted: true };
  },
};
