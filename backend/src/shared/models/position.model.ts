import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'position';
const COLLECTION_NAME = 'positions';

export const POSITION_STATUS = ['active', 'archived'] as const;
export type PositionStatus = (typeof POSITION_STATUS)[number];

export interface IPosition {
  title: string;
  code: string;
  departmentId: Types.ObjectId;
  level: number;
  description: string;
  status: PositionStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type PositionDoc = HydratedDocument<IPosition>;

const positionSchema = new Schema<IPosition>(
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
    status: { type: String, enum: POSITION_STATUS, default: 'active', index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Position = mongoose.model<IPosition>(DB_NAME, positionSchema);