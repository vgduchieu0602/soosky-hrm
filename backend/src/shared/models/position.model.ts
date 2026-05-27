import mongoose, { Schema } from 'mongoose';

const DB_NAME = 'position';
const COLLECTION_NAME = 'positions';

const positionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'departments',
      required: true,
      index: true,
    },
    level: { type: Number, required: true, min: 1 },
    description: { type: String, default: '' },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Position = mongoose.model(DB_NAME, positionSchema);