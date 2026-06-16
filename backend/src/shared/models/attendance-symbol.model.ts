import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'attendanceSymbol';
const COLLECTION_NAME = 'attendanceSymbols';

export const PAID_STATUS = ['paid', 'unpaid', 'neutral'] as const;
export type PaidStatus = (typeof PAID_STATUS)[number];

export interface IAttendanceSymbol {
  code: string;
  label: string;
  paidStatus: PaidStatus;
  affectsPayroll: boolean;
  leaveType?: string;
  color?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type AttendanceSymbolDoc = HydratedDocument<IAttendanceSymbol>;

const attendanceSymbolSchema = new Schema<IAttendanceSymbol>(
  {
    code: { type: String, required: true, unique: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    paidStatus: { type: String, enum: PAID_STATUS, default: 'neutral' },
    affectsPayroll: { type: Boolean, default: false },
    leaveType: { type: String, trim: true },
    color: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const AttendanceSymbol = mongoose.model<IAttendanceSymbol>(DB_NAME, attendanceSymbolSchema);
