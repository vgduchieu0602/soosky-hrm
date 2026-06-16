import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'employeeProfile';
const COLLECTION_NAME = 'employeeProfiles';

export const GENDER = ['male', 'female', 'other', 'undisclosed'] as const;
export type Gender = (typeof GENDER)[number];

export const MARITAL_STATUS = ['single', 'married', 'divorced', 'widowed'] as const;
export type MaritalStatus = (typeof MARITAL_STATUS)[number];

export interface IEmployeeProfile {
  employeeId: Types.ObjectId;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: Gender;
  nationality?: string;
  maritalStatus?: MaritalStatus;
  avatarUrl?: string;
  avatarId?: string;
  email?: string; // personal email (used to send temp password)
  workEmail?: string; // company email shown on the profile
  phone?: string;
  address?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type EmployeeProfileDoc = HydratedDocument<IEmployeeProfile>;

const employeeProfileSchema = new Schema<IEmployeeProfile>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'employees',
      required: true,
      unique: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: GENDER, default: 'undisclosed' },
    nationality: { type: String, default: 'VN', uppercase: true, trim: true },
    maritalStatus: { type: String, enum: MARITAL_STATUS, default: 'single' },
    avatarUrl: { type: String },
    avatarId: { type: String },
    email: { type: String, lowercase: true, trim: true },
    workEmail: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const EmployeeProfile = mongoose.model<IEmployeeProfile>(DB_NAME, employeeProfileSchema);
