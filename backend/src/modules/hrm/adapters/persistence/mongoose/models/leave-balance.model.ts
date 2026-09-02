import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';
import { LEAVE_TYPE, type LeaveType } from '@modules/hrm/adapters/persistence/mongoose/models/leave-request.model';

const DB_NAME = 'leaveBalance';
const COLLECTION_NAME = 'leaveBalances';

export interface ILeaveBalance {
  employeeId: Types.ObjectId;
  leaveType: LeaveType;
  year: number;
  entitled: number; // 0 = không giới hạn (unpaid)
  used: number;
  created_at?: Date;
  updated_at?: Date;
}

export type LeaveBalanceDoc = HydratedDocument<ILeaveBalance>;

const leaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPE, required: true },
    year: { type: Number, required: true },
    entitled: { type: Number, default: 0, min: 0 },
    used: { type: Number, default: 0, min: 0 },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

leaveBalanceSchema.index({ employeeId: 1, leaveType: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model<ILeaveBalance>(DB_NAME, leaveBalanceSchema);
