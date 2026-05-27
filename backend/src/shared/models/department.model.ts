import mongoose, { Schema } from 'mongoose';

const DB_NAME = 'department';
const COLLECTION_NAME = 'departments';

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    parentDepartmentId: {
      type: Schema.Types.ObjectId,
      ref: COLLECTION_NAME,
      default: null,
      index: true,
    },
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

export const Department = mongoose.model(DB_NAME, departmentSchema);
