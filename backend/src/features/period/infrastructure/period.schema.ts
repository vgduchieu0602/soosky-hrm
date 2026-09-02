import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';
import type { IPayrollPeriod } from '../domain/ports';

const DB_NAME = 'payrollPeriod';
const COLLECTION_NAME = 'payrollPeriods';

export const PAYROLL_PERIOD_STATUS = ['open', 'processing', 'closed', 'paid'] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUS)[number];

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
    performanceLockedAt: { type: Date, default: null },
    performanceLockedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const PayrollPeriod = mongoose.model<IPayrollPeriod>(DB_NAME, payrollPeriodSchema);
