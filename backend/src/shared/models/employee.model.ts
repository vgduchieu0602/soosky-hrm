import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employee';
const COLLECTION_NAME = 'employees';

export const EMPLOYEE_TYPE = ['full_time', 'part_time', 'contract', 'intern'] as const;
export type EmployeeType = (typeof EMPLOYEE_TYPE)[number];

export const EMPLOYEE_STATUS = ['onboarding', 'active', 'on_leave', 'terminated'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[number];

export const SALARY_ZONE = ['zone1', 'zone2', 'zone3', 'zone4'] as const;
export type SalaryZone = (typeof SALARY_ZONE)[number];

export interface IEmployee {
  employeeCode: string;
  userId?: Types.ObjectId | null;
  departmentId: Types.ObjectId;
  positionId: Types.ObjectId;
  managerId?: Types.ObjectId | null;
  hireDate: Date;
  terminationDate?: Date | null;
  employeeType: EmployeeType;
  status: EmployeeStatus;
  salaryZone?: SalaryZone;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeDoc = HydratedDocument<IEmployee>;

const employeeSchema = new Schema<IEmployee>(
  {
    employeeCode: { type: String, required: true, unique: true, index: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'departments',
      required: true,
      index: true,
    },
    positionId: { type: Schema.Types.ObjectId, ref: 'positions', required: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'employees', default: null, index: true },
    hireDate: { type: Date, required: true },
    terminationDate: { type: Date, default: null },
    employeeType: { type: String, enum: EMPLOYEE_TYPE, required: true },
    status: { type: String, enum: EMPLOYEE_STATUS, default: 'onboarding', index: true },
    salaryZone: { type: String, enum: SALARY_ZONE },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

employeeSchema.index({ userId: 1 }, { unique: true, sparse: true });
employeeSchema.index({ departmentId: 1, status: 1 });

export const Employee = mongoose.model<IEmployee>(DB_NAME, employeeSchema);
