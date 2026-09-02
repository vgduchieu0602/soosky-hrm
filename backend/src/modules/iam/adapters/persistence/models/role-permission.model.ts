import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'rolePermission';
const COLLECTION_NAME = 'rolePermissions';

export interface IRolePermission {
  roleId: Types.ObjectId;
  permissionId: Types.ObjectId;
  created_at?: Date;
  updated_at?: Date;
}

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    roleId: { type: Schema.Types.ObjectId, ref: 'role', required: true, index: true },
    permissionId: { type: Schema.Types.ObjectId, ref: 'permission', required: true, index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

rolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });

export type RolePermissionDoc = HydratedDocument<IRolePermission>;
export const RolePermission = mongoose.model<IRolePermission>(DB_NAME, rolePermissionSchema);
