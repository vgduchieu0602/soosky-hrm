import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'allowance';
const COLLECTION_NAME = 'allowances';

export const ALLOWANCE_AMOUNT_TYPE = ['fixed', 'percentage'] as const;
export type AllowanceAmountType = (typeof ALLOWANCE_AMOUNT_TYPE)[number];

export const ALLOWANCE_CATEGORY = [
  'position',
  'responsibility',
  'transport',
  'meal',
  'housing',
  'phone',
  'other',
] as const;
export type AllowanceCategory = (typeof ALLOWANCE_CATEGORY)[number];

/**
 * Recurring allowance attached to an employee. Pulled into each payroll run
 * while active. `amount` is interpreted per `type`: a fixed VND figure, or a
 * percentage of base salary.
 */
export interface IAllowance {
  employeeId: Types.ObjectId;
  name: string;
  category: AllowanceCategory;
  type: AllowanceAmountType;
  /** Fixed amount in VND (Decimal128) when type='fixed'; percent when 'percentage'. */
  amount: mongoose.Types.Decimal128;
  /** Counts toward taxable income. */
  isTaxable: boolean;
  /** Included in the social/health insurance base. */
  isInsuranceBase: boolean;
  effectiveDate: Date;
  endDate?: Date | null;
  note?: string | null;
  createdBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type AllowanceDoc = HydratedDocument<IAllowance>;

const allowanceSchema = new Schema<IAllowance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ALLOWANCE_CATEGORY, default: 'other' },
    type: { type: String, enum: ALLOWANCE_AMOUNT_TYPE, required: true, default: 'fixed' },
    amount: { type: Schema.Types.Decimal128, required: true },
    isTaxable: { type: Boolean, required: true, default: true },
    isInsuranceBase: { type: Boolean, required: true, default: false },
    effectiveDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    note: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

allowanceSchema.index({ employeeId: 1, effectiveDate: -1 });

export const Allowance = mongoose.model<IAllowance>(DB_NAME, allowanceSchema);
