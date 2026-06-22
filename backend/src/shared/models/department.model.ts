import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'department';
const COLLECTION_NAME = 'departments';

export type DepartmentStatus = 'active' | 'archived';

export interface IDepartment {
  name: string;
  code: string;
  parentDepartmentId?: Types.ObjectId | null;
  managerId?: Types.ObjectId | null;
  costCenter?: string;
  location?: string;
  email?: string;
  description: string;
  status: DepartmentStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type DepartmentDoc = HydratedDocument<IDepartment>;

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    parentDepartmentId: {
      type: Schema.Types.ObjectId,
      ref: COLLECTION_NAME,
      default: null,
      index: true,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'employee',
      default: null,
      index: true,
    },
    costCenter: { type: String, trim: true },
    location: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Department = mongoose.model<IDepartment>(DB_NAME, departmentSchema);
