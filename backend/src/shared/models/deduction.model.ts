import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'deduction';
const COLLECTION_NAME = 'deductions';

export const DEDUCTION_AMOUNT_TYPE = ['fixed', 'percentage'] as const;
export type DeductionAmountType = (typeof DEDUCTION_AMOUNT_TYPE)[number];

/**
 * Post-tax deduction applied to net pay (e.g. advance repayment, union fee,
 * disciplinary). If `payrollPeriodId` is null the deduction recurs each period
 * while active; otherwise it applies to that single period only.
 */
export interface IDeduction {
  employeeId: Types.ObjectId;
  /** null = recurring; set = one-off for that period. */
  payrollPeriodId?: Types.ObjectId | null;
  name: string;
  type: DeductionAmountType;
  /** VND (Decimal128) when type='fixed'; percent of gross when 'percentage'. */
  amount: mongoose.Types.Decimal128;
  reason?: string | null;
  effectiveDate: Date;
  endDate?: Date | null;
  createdBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type DeductionDoc = HydratedDocument<IDeduction>;

const deductionSchema = new Schema<IDeduction>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    payrollPeriodId: { type: Schema.Types.ObjectId, ref: 'payrollPeriods', default: null },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: DEDUCTION_AMOUNT_TYPE, required: true, default: 'fixed' },
    amount: { type: Schema.Types.Decimal128, required: true },
    reason: { type: String, default: null },
    effectiveDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

deductionSchema.index({ employeeId: 1, payrollPeriodId: 1 });

export const Deduction = mongoose.model<IDeduction>(DB_NAME, deductionSchema);
