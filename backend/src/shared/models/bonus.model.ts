import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'bonus';
const COLLECTION_NAME = 'bonuses';

/**
 * One-off bonus for a specific payroll period (e.g. "Q2 Bonus", "Tết").
 * Added to gross at compute time; taxable unless explicitly flagged otherwise.
 */
export interface IBonus {
  employeeId: Types.ObjectId;
  payrollPeriodId: Types.ObjectId;
  name: string;
  amount: mongoose.Types.Decimal128;
  isTaxable: boolean;
  reason?: string | null;
  approvedBy?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type BonusDoc = HydratedDocument<IBonus>;

const bonusSchema = new Schema<IBonus>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    payrollPeriodId: {
      type: Schema.Types.ObjectId,
      ref: 'payrollPeriods',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    isTaxable: { type: Boolean, required: true, default: true },
    reason: { type: String, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

bonusSchema.index({ employeeId: 1, payrollPeriodId: 1 });

export const Bonus = mongoose.model<IBonus>(DB_NAME, bonusSchema);
