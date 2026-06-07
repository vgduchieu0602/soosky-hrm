import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeContact';
const COLLECTION_NAME = 'employeeContacts';

export const RELATIONSHIP = ['spouse', 'parent', 'sibling', 'other'] as const;
export type Relationship = (typeof RELATIONSHIP)[number];

export interface IEmployeeContact {
  employeeId: Types.ObjectId;
  name: string;
  relationship: Relationship;
  phone?: string;
  email?: string;
  address?: string;
  isPrimary: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeContactDoc = HydratedDocument<IEmployeeContact>;

const employeeContactSchema = new Schema<IEmployeeContact>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    name: { type: String, required: true, trim: true },
    relationship: { type: String, enum: RELATIONSHIP, required: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const EmployeeContact = mongoose.model<IEmployeeContact>(DB_NAME, employeeContactSchema);
