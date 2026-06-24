import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'companyConfig';
const COLLECTION_NAME = 'companyConfigs';

// Singleton document holding company-wide / general settings.
export interface ICompanyConfig {
  /** Fixed key so there is always exactly one config document. */
  key: string;
  companyName: string;
  logoUrl?: string;
  /** Timezone for attendance time comparisons (check-in/out, late/early). */
  timezone: string;
  /** Default standard working days per month, used as PayrollPeriod default. */
  standardWorkDays: number;
  /** Attendance tolerance — minutes of grace before "late" / "early leave". */
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  /**
   * Whether overtime is paid. Default false: the OT engine exists but
   * `overtimePay` stays 0 for every payroll until this is turned on.
   */
  overtimeEnabled: boolean;
  /**
   * Whether lateness reduces pay. Default false: late is tracked (lateMinutes)
   * but a late day still counts as a full paid work day.
   */
  lateAffectsPay: boolean;
  /** Default annual leave entitlement per leave type, seeded when an employee is created. */
  leaveQuotas?: Record<string, number>;
  contactEmail?: string;
  address?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type CompanyConfigDoc = HydratedDocument<ICompanyConfig>;

const companyConfigSchema = new Schema<ICompanyConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    companyName: { type: String, required: true, default: 'Soosky', trim: true },
    logoUrl: { type: String },
    timezone: { type: String, default: 'Asia/Ho_Chi_Minh', trim: true },
    standardWorkDays: { type: Number, default: 22, min: 1, max: 31 },
    graceLateMinutes: { type: Number, default: 5, min: 0, max: 120 },
    graceEarlyMinutes: { type: Number, default: 5, min: 0, max: 120 },
    overtimeEnabled: { type: Boolean, default: false },
    lateAffectsPay: { type: Boolean, default: false },
    leaveQuotas: { type: Schema.Types.Mixed, default: {} },
    contactEmail: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const CompanyConfig = mongoose.model<ICompanyConfig>(DB_NAME, companyConfigSchema);
