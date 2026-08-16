import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeContract';
const COLLECTION_NAME = 'employeeContracts';

// Loại HĐLĐ — only the two statutory types (Bộ luật Lao động 2019, Điều 20).
export const CONTRACT_TYPE = ['fixed_term', 'indefinite'] as const;
export type ContractType = (typeof CONTRACT_TYPE)[number];

// Tình trạng làm việc — drives payroll: probation → 85% of contract salary;
// internship → full contract salary (attendance-prorated only); both have no
// compulsory insurance. official → full salary + insurance.
export const EMPLOYMENT_STATUS = ['probation', 'official', 'internship'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUS)[number];

export const CONTRACT_STATUS = ['active', 'expired', 'terminated'] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

export interface IEmployeeContract {
  employeeId: Types.ObjectId;
  contractType: ContractType;
  employmentStatus: EmploymentStatus;
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
    employmentStatus: { type: String, enum: EMPLOYMENT_STATUS, default: 'official' },
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

// Payroll tra hợp đồng theo KHOẢNG HIỆU LỰC (startDate ≤ hết kỳ, endDate ≥ đầu
// kỳ) chứ không theo `status`, nên cần index theo ngày bắt đầu.
employeeContractSchema.index({ employeeId: 1, startDate: 1 });

// Serialize Decimal128 baseSalary to a plain string so clients never receive
// the raw `{ $numberDecimal }` BSON wrapper. (Lean reads are normalized in the
// repository instead, since lean bypasses this transform.)
employeeContractSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    if (r.baseSalary != null && typeof r.baseSalary === 'object') {
      r.baseSalary = String(r.baseSalary);
    }
    return r;
  },
});

export const EmployeeContractModel = mongoose.model<IEmployeeContract>(
  DB_NAME,
  employeeContractSchema,
);
