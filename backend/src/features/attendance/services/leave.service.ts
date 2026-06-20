import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Employee } from '@shared/models/employee.model';
import { Attendance } from '@shared/models/attendance.model';
import { Holiday } from '@shared/models/holiday.model';
import { LeaveRequest, type LeaveType } from '@shared/models/leave-request.model';
import { LeaveBalance } from '@shared/models/leave-balance.model';
import { auditService } from '@features/iam/services/audit.service';
import {
  vnDateKey,
  enumerateDays,
  isWeekend,
  mmddKey,
} from '@features/attendance/services/attendance-calc';
import type { SubmitLeaveDto } from '@features/attendance/dto/leave.dto';

const log = logger.child({ feature: 'attendance', module: 'leave' });

async function employeeOfUser(userId: string) {
  const employee = await Employee.findOne({ userId });
  if (!employee) throw new HttpError(404, 'Không tìm thấy hồ sơ nhân viên', 'EMP_001');
  return employee;
}

/**
 * Load holidays overlapping [start, end] and return a predicate that tells
 * whether a given date-key is a public holiday. Matches fixed-date holidays
 * exactly and recurring holidays by MM-DD across the spanned years.
 */
async function resolveHolidayChecker(start: Date, end: Date): Promise<(d: Date) => boolean> {
  const s = vnDateKey(start);
  const e = vnDateKey(end);
  const holidays = await Holiday.find({
    $or: [{ date: { $gte: s, $lte: e } }, { isRecurring: true }],
  }).lean();

  const fixed = new Set<number>();
  const recurring = new Set<string>();
  for (const h of holidays) {
    const key = vnDateKey(h.date);
    if (h.isRecurring) recurring.add(mmddKey(key));
    else fixed.add(key.getTime());
  }
  return (d: Date) => fixed.has(d.getTime()) || recurring.has(mmddKey(d));
}

/** Working days in [start, end], excluding weekends and holidays. Half-day = 0.5. */
export async function countWorkingDays(
  start: Date,
  end: Date,
  half?: string | null,
): Promise<number> {
  if (half) return 0.5;
  const isHoliday = await resolveHolidayChecker(start, end);
  let count = 0;
  for (const day of enumerateDays(start, end)) {
    if (isWeekend(day) || isHoliday(day)) continue;
    count += 1;
  }
  return count;
}

/** Throw LV_004 if the leave type has a finite quota and would be exceeded. */
async function assertBalanceAvailable(
  employeeId: Types.ObjectId,
  leaveType: LeaveType,
  startDate: Date,
  days: number,
  session?: ClientSession,
) {
  const year = vnDateKey(startDate).getUTCFullYear();
  const q = LeaveBalance.findOne({ employeeId, leaveType, year });
  const balance = await (session ? q.session(session) : q).lean();
  // entitled === 0 means unlimited (e.g. unpaid); no balance row → not yet
  // configured, treat as unlimited and let HR initialise quotas (G4).
  if (balance && balance.entitled > 0 && balance.used + days > balance.entitled) {
    const remaining = balance.entitled - balance.used;
    throw new HttpError(409, `Vượt quỹ phép còn lại (${remaining} ngày)`, 'LV_004');
  }
}

/** Generate the attendance rows for an approved leave (idempotent by leaveRequestId). */
async function syncLeaveAttendance(
  req: { _id: Types.ObjectId; employeeId: Types.ObjectId; leaveType: LeaveType; startDate: Date; endDate: Date; halfDaySession?: string | null; createdBy?: Types.ObjectId | null },
  session: ClientSession,
) {
  const status = req.leaveType === 'unpaid' ? 'leave_unpaid' : 'leave_paid';
  const attSession = req.halfDaySession ?? 'full_day';
  const isHoliday = await resolveHolidayChecker(req.startDate, req.endDate);
  const days = req.halfDaySession
    ? [vnDateKey(req.startDate)]
    : enumerateDays(req.startDate, req.endDate).filter((d) => !isWeekend(d) && !isHoliday(d));

  for (const day of days) {
    await Attendance.updateOne(
      { employeeId: req.employeeId, date: day, leaveRequestId: req._id },
      {
        $set: {
          session: attSession,
          shiftId: null,
          status,
          workHours: 0,
          lateMinutes: 0,
          earlyMinutes: 0,
          source: 'leave',
          createdBy: req.createdBy ?? null,
        },
      },
      { upsert: true, session },
    );
  }
}

/** Remove attendance rows generated from a leave request (for reject/cancel). */
async function clearLeaveAttendance(reqId: Types.ObjectId, session?: ClientSession) {
  const q = Attendance.deleteMany({ leaveRequestId: reqId });
  await (session ? q.session(session) : q);
}

function withEmployeePipeline(match: Record<string, unknown>): PipelineStage[] {
  return [
    { $match: match },
    { $sort: { created_at: -1 } },
    {
      $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' },
    },
    { $unwind: { path: '$employee', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'employeeProfiles',
        localField: 'employeeId',
        foreignField: 'employeeId',
        as: 'profile',
      },
    },
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

export const leaveService = {
  async submit(userId: string, dto: SubmitLeaveDto) {
    const employee = await employeeOfUser(userId);
    if (vnDateKey(dto.endDate).getTime() < vnDateKey(dto.startDate).getTime()) {
      throw new HttpError(400, 'Ngày kết thúc phải sau ngày bắt đầu', 'LV_003');
    }
    const days = await countWorkingDays(dto.startDate, dto.endDate, dto.halfDaySession);
    if (days <= 0) {
      throw new HttpError(400, 'Khoảng nghỉ không có ngày làm việc nào', 'LV_003');
    }
    await assertBalanceAvailable(employee._id, dto.leaveType, dto.startDate, days);
    const doc = await LeaveRequest.create({
      employeeId: employee._id,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days,
      halfDaySession: dto.halfDaySession ?? null,
      reason: dto.reason ?? null,
      status: 'pending',
      createdBy: new Types.ObjectId(userId),
    });
    log.info({ id: doc._id, employeeId: employee._id }, 'leave request submitted');
    return doc.toJSON();
  },

  async mine(userId: string) {
    const employee = await employeeOfUser(userId);
    return LeaveRequest.find({ employeeId: employee._id }).sort({ created_at: -1 }).lean();
  },

  async cancelOwn(userId: string, id: string) {
    const employee = await employeeOfUser(userId);
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
    const req = await LeaveRequest.findById(id);
    if (!req || req.employeeId.toString() !== employee._id.toString()) {
      throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
    }
    if (req.status !== 'pending') {
      throw new HttpError(409, 'Chỉ huỷ được đơn đang chờ duyệt', 'LV_002');
    }
    req.status = 'cancelled';
    await req.save();
    return req.toJSON();
  },

  adminList(filter: { status?: string }) {
    const match: Record<string, unknown> = {};
    if (filter.status) match.status = filter.status;
    return LeaveRequest.aggregate(withEmployeePipeline(match));
  },

  /** Approve atomically: set status + increment the year's leave balance. */
  async approve(id: string, approverUserId: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
    const session = await mongoose.startSession();
    try {
      let result: unknown;
      await session.withTransaction(async () => {
        const req = await LeaveRequest.findById(id).session(session);
        if (!req) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
        if (req.status !== 'pending') {
          throw new HttpError(409, 'Đơn đã được xử lý', 'LV_002');
        }

        // Re-check quota inside the transaction (balance may have changed).
        await assertBalanceAvailable(
          req.employeeId,
          req.leaveType,
          req.startDate,
          req.days,
          session,
        );

        req.status = 'approved';
        req.approverId = new Types.ObjectId(approverUserId);
        req.approvedAt = new Date();
        await req.save({ session });

        const year = vnDateKey(req.startDate).getUTCFullYear();
        await LeaveBalance.updateOne(
          { employeeId: req.employeeId, leaveType: req.leaveType, year },
          { $inc: { used: req.days }, $setOnInsert: { entitled: 0 } },
          { upsert: true, session },
        );

        // Reflect the approved leave into the attendance grid so payroll sees it.
        await syncLeaveAttendance(req, session);

        await auditService.record({
          userId: approverUserId,
          resource: 'leaveRequest',
          action: 'update',
          resourceId: req._id.toString(),
          changes: { approved: true, days: req.days },
        });
        result = req.toJSON();
      });
      log.info({ id }, 'leave approved');
      return result;
    } finally {
      await session.endSession();
    }
  },

  async reject(id: string, approverUserId: string, reason: string) {
    if (!Types.ObjectId.isValid(id)) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
    const req = await LeaveRequest.findById(id);
    if (!req) throw new HttpError(404, 'Không tìm thấy đơn', 'LV_001');
    if (req.status !== 'pending') throw new HttpError(409, 'Đơn đã được xử lý', 'LV_002');
    req.status = 'rejected';
    req.rejectionReason = reason;
    req.approverId = new Types.ObjectId(approverUserId);
    req.approvedAt = new Date();
    await req.save();
    // Defensive: a pending request has no attendance yet, but stay consistent.
    await clearLeaveAttendance(req._id);
    await auditService.record({
      userId: approverUserId,
      resource: 'leaveRequest',
      action: 'update',
      resourceId: req._id.toString(),
      changes: { rejected: true, reason },
    });
    log.info({ id }, 'leave rejected');
    return req.toJSON();
  },

  async myBalances(userId: string) {
    const employee = await employeeOfUser(userId);
    const year = new Date().getUTCFullYear();
    return LeaveBalance.find({ employeeId: employee._id, year }).lean();
  },

  async adminBalances(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId)) {
      throw new HttpError(400, 'employeeId không hợp lệ', 'EMP_001');
    }
    const year = new Date().getUTCFullYear();
    return LeaveBalance.find({ employeeId: new Types.ObjectId(employeeId), year }).lean();
  },
};
