import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'role';
const COLLECTION_NAME = 'roles';

export interface IRole {
  name: string;
  description: string;
  isSystem: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type RoleDoc = HydratedDocument<IRole>;

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, index: true }, // 'admin' | 'hr_manager' | 'employee'
    description: { type: String, default: '' },
    isSystem: { type: Boolean, default: false }, // built-in roles cannot be deleted
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// Guard hook — system roles are immutable at the DB layer.
roleSchema.pre<RoleDoc>('deleteOne', { document: true, query: false }, async function () {
  if (this.isSystem) throw new Error('Cannot delete a system role');
});

export const Role = mongoose.model<IRole>(DB_NAME, roleSchema);
