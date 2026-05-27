import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'user'
const COLLECTION_NAME = 'users';

export const USER_STATUS = ['active', 'disabled', 'locked'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export interface IUser {
  username: string;
  email: string;
  password: string;
  status: UserStatus;
  employeeId?: Types.ObjectId | null;
  mustChangePassword: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  created_at?: Date;
  updated_at?: Date;
}

export type UserDoc = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, index: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false }, // never returned by default
    status: { type: String, enum: USER_STATUS, default: 'active', index: true },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'employees',
      // sparse: nullable until HR grants login; unique so each user maps to one employee
    },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

userSchema.index({ employeeId: 1 }, { unique: true, sparse: true });

// Strip password from any JSON serialization, regardless of caller.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as unknown as Record<string, unknown>).password;
    return ret;
  },
});

export const User = mongoose.model<IUser>(DB_NAME, userSchema);
