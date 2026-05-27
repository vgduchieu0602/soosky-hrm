import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'permission';
const COLLECTION_NAME = 'permissions';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'approve';

export interface IPermission {
  key: string;
  resource: string;
  action: PermissionAction;
  description: string;
  created_at?: Date;
  updated_at?: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    key: { type: String, required: true, unique: true, index: true }, // e.g. "employee:create"
    resource: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'approve'],
      required: true,
    },
    description: { type: String, default: '' },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export type PermissionDoc = HydratedDocument<IPermission>;
export const Permission = mongoose.model<IPermission>(DB_NAME, permissionSchema);
