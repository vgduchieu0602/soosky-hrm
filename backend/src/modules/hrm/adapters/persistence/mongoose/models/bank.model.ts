import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'bank';
const COLLECTION_NAME = 'banks';

export const BANK_STATUS = ['active', 'archived'] as const;
export type BankStatus = (typeof BANK_STATUS)[number];

export interface IBank {
  name: string;
  code?: string;
  status: BankStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type BankDoc = HydratedDocument<IBank>;

const bankSchema = new Schema<IBank>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    status: { type: String, enum: BANK_STATUS, default: 'active', index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Bank = mongoose.model<IBank>(DB_NAME, bankSchema);
