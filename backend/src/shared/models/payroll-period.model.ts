import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'payrollPeriod';
const COLLECTION_NAME = 'payrollPeriods';

export const PAYROLL_PERIOD_STATUS = ['open', 'processing', 'closed', 'paid'] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUS)[number];

export interface IPayrollPeriod {
  /** Human label, unique — e.g. "2026-05". */
  name: string;
  startDate: Date;
  endDate: Date;
  payDate: Date;
  /** Snapshot of CompanyConfig.standardWorkDays at creation time. */
  standardWorkDays: number;
  status: PayrollPeriodStatus;
  /** Set when the period is closed (locks computed payrolls from re-run). */
  closedAt?: Date | null;
  closedBy?: Types.ObjectId | null;
  /** Set when attendance is locked — must precede payroll run; blocks edits. */
  attendanceLockedAt?: Date | null;
  attendanceLockedBy?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type PayrollPeriodDoc = HydratedDocument<IPayrollPeriod>;

const payrollPeriodSchema = new Schema<IPayrollPeriod>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    payDate: { type: Date, required: true },
    standardWorkDays: { type: Number, required: true, default: 22 },
    status: { type: String, enum: PAYROLL_PERIOD_STATUS, default: 'open', index: true },
    closedAt: { type: Date, default: null },
    closedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    attendanceLockedAt: { type: Date, default: null },
    attendanceLockedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const PayrollPeriod = mongoose.model<IPayrollPeriod>(DB_NAME, payrollPeriodSchema);
