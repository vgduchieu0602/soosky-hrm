import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeHistory';
const COLLECTION_NAME = 'employeeHistories';

export const HISTORY_EVENT = [
  'hired',
  'promotion',
  'transfer',
  'salary_change',
  'contract_renew',
  'info_update',
  'terminated',
] as const;
export type HistoryEvent = (typeof HISTORY_EVENT)[number];

export interface IEmployeeHistory {
  employeeId: Types.ObjectId;
  eventType: HistoryEvent;
  fromValue?: Record<string, unknown>;
  toValue?: Record<string, unknown>;
  effectiveDate: Date;
  note?: string;
  createdBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeHistoryDoc = HydratedDocument<IEmployeeHistory>;

const employeeHistorySchema = new Schema<IEmployeeHistory>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    eventType: { type: String, enum: HISTORY_EVENT, required: true },
    fromValue: { type: Schema.Types.Mixed },
    toValue: { type: Schema.Types.Mixed },
    effectiveDate: { type: Date, required: true },
    note: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

employeeHistorySchema.index({ employeeId: 1, effectiveDate: -1 });

export const EmployeeHistory = mongoose.model<IEmployeeHistory>(DB_NAME, employeeHistorySchema);
