import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeBankAccount';
const COLLECTION_NAME = 'employeeBankAccounts';

export interface IEmployeeBankAccount {
  employeeId: Types.ObjectId;
  bankName: string;
  branch?: string;
  accountNumber: string;
  accountHolder: string;
  isPrimary: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeBankAccountDoc = HydratedDocument<IEmployeeBankAccount>;

const employeeBankAccountSchema = new Schema<IEmployeeBankAccount>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    bankName: { type: String, required: true, trim: true },
    branch: { type: String, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    accountHolder: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const EmployeeBankAccount = mongoose.model<IEmployeeBankAccount>(
  DB_NAME,
  employeeBankAccountSchema,
);
