import mongoose, { Types, type PipelineStage } from 'mongoose';
import { logger } from '@core/logger/logger';
import { HttpError } from '@shared/errors/http-error';
import { Employee } from '@shared/models/employee.model';
import { LeaveRequest } from '@shared/models/leave-request.model';
import { LeaveBalance } from '@shared/models/leave-balance.model';
import { auditService } from '@features/iam/services/audit.service';
import { vnDateKey } from '@features/attendance/services/attendance-calc';
import type { SubmitLeaveDto } from '@features/attendance/dto/leave.dto';

const log = logger.child({ feature: 'attendance', module: 'leave' });

async function employeeOfUser(userId: string) {
  const employee = await Employee.findOne({ userId });
  if (!employee) throw new HttpError(404, 'Không tìm thấy hồ sơ nhân viên', 'EMP_001');
  return employee;
}

function countDays(start: Date, end: Date, half?: string | null): number {
  if (half) return 0.5;
  const ms = vnDateKey(end).getTime() - vnDateKey(start).getTime();
  return Math.floor(ms / 86_400_000) + 1;
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
    const days = countDays(dto.startDate, dto.endDate, dto.halfDaySession);
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

        req.status = 'approved';
        req.approverId = new Types.ObjectId(approverUserId);
        req.approvedAt = new Date();
        await req.save({ session });

        const year = req.startDate.getUTCFullYear();
        await LeaveBalance.updateOne(
          { employeeId: req.employeeId, leaveType: req.leaveType, year },
          { $inc: { used: req.days }, $setOnInsert: { entitled: 0 } },
          { upsert: true, session },
        );

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
