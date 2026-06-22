import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'userRole';
const COLLECTION_NAME = 'userRoles';

export interface IUserRole {
  userId: Types.ObjectId;
  roleId: Types.ObjectId;
  assignedAt: Date;
  expiresAt?: Date;
  created_at?: Date;
  updated_at?: Date;
}

const userRoleSchema = new Schema<IUserRole>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'role', required: true, index: true },
    assignedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date }, // optional — for temporary grants (acting manager)
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

userRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export type UserRoleDoc = HydratedDocument<IUserRole>;
export const UserRole = mongoose.model<IUserRole>(DB_NAME, userRoleSchema);
