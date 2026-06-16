import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'companyConfig';
const COLLECTION_NAME = 'companyConfigs';

// Singleton document holding company-wide / general settings.
export interface ICompanyConfig {
  /** Fixed key so there is always exactly one config document. */
  key: string;
  companyName: string;
  logoUrl?: string;
  timezone: string;
  locale: string;
  currency: string;
  /** Default standard working days per month, used as PayrollPeriod default. */
  standardWorkDays: number;
  /** Fiscal/pay cycle anchor day of month (1–28). */
  payCycleStartDay: number;
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
    locale: { type: String, default: 'vi-VN', trim: true },
    currency: { type: String, default: 'VND', uppercase: true, trim: true },
    standardWorkDays: { type: Number, default: 22, min: 1, max: 31 },
    payCycleStartDay: { type: Number, default: 1, min: 1, max: 28 },
    contactEmail: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const CompanyConfig = mongoose.model<ICompanyConfig>(DB_NAME, companyConfigSchema);
