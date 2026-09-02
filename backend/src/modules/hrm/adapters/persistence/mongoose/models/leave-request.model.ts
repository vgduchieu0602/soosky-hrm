import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'leaveRequest';
const COLLECTION_NAME = 'leaveRequests';

export const LEAVE_TYPE = [
  'annual',
  'sick',
  'personal',
  'unpaid',
  'maternity',
  'paternity',
] as const;
export type LeaveType = (typeof LEAVE_TYPE)[number];

export const LEAVE_STATUS = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export type LeaveStatus = (typeof LEAVE_STATUS)[number];

export interface ILeaveRequest {
  employeeId: Types.ObjectId;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  halfDaySession?: 'morning' | 'afternoon' | null;
  reason?: string | null;
  status: LeaveStatus;
  approverId?: Types.ObjectId | null; // user who approved/rejected
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  createdBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type LeaveRequestDoc = HydratedDocument<ILeaveRequest>;

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPE, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0 },
    halfDaySession: { type: String, enum: ['morning', 'afternoon'], default: null },
    reason: { type: String, default: null },
    status: { type: String, enum: LEAVE_STATUS, default: 'pending', index: true },
    approverId: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

leaveRequestSchema.index({ employeeId: 1, status: 1 });

export const LeaveRequest = mongoose.model<ILeaveRequest>(DB_NAME, leaveRequestSchema);
