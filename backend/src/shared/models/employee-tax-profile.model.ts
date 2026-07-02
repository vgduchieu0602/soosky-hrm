import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeTaxProfile';
const COLLECTION_NAME = 'employeeTaxProfiles';

/**
 * Tax-relevant attributes for an employee. Versioned by effectiveDate so a
 * change in dependents/residency mid-year is auditable; payroll snapshots the
 * values in effect at compute time.
 */
export interface IEmployeeTaxProfile {
  employeeId: Types.ObjectId;
  /** Personal tax code (MST). Sparse unique — may be unknown for new hires. */
  taxCode?: string | null;
  /** Tax resident → progressive brackets; non-resident → flat rate from policy. */
  isResident: boolean;
  /** Number of registered dependents (người phụ thuộc) for the deduction. */
  dependentsCount: number;
  /** Fixed compulsory-insurance amount (BHXH) deducted per period, entered by HR. */
  insuranceAmount?: number;
  effectiveDate: Date;
  endDate?: Date | null;
  note?: string | null;
  createdBy?: Types.ObjectId | null;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeTaxProfileDoc = HydratedDocument<IEmployeeTaxProfile>;

const employeeTaxProfileSchema = new Schema<IEmployeeTaxProfile>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    taxCode: { type: String, trim: true, sparse: true, unique: true, default: null },
    isResident: { type: Boolean, required: true, default: true },
    dependentsCount: { type: Number, required: true, default: 0, min: 0 },
    insuranceAmount: { type: Number, default: 0, min: 0 },
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

employeeTaxProfileSchema.index({ employeeId: 1, effectiveDate: -1 });

export const EmployeeTaxProfile = mongoose.model<IEmployeeTaxProfile>(
  DB_NAME,
  employeeTaxProfileSchema,
);
