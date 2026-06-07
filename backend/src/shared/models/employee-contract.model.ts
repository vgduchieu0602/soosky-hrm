import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeContract';
const COLLECTION_NAME = 'employeeContracts';

export const CONTRACT_TYPE = ['probation', 'fixed_term', 'indefinite', 'internship'] as const;
export type ContractType = (typeof CONTRACT_TYPE)[number];

export const CONTRACT_STATUS = ['active', 'expired', 'terminated'] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

export interface IEmployeeContract {
  employeeId: Types.ObjectId;
  contractType: ContractType;
  contractNumber: string;
  startDate: Date;
  endDate?: Date | null;
  baseSalary: mongoose.Types.Decimal128;
  currency: string;
  fileUrl?: string;
  status: ContractStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeContractDoc = HydratedDocument<IEmployeeContract>;

const employeeContractSchema = new Schema<IEmployeeContract>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    contractType: { type: String, enum: CONTRACT_TYPE, required: true },
    contractNumber: { type: String, required: true, unique: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    baseSalary: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, default: 'VND', uppercase: true, trim: true },
    fileUrl: { type: String },
    status: { type: String, enum: CONTRACT_STATUS, default: 'active', index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const EmployeeContractModel = mongoose.model<IEmployeeContract>(
  DB_NAME,
  employeeContractSchema,
);
