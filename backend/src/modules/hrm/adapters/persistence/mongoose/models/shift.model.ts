import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'shift';
const COLLECTION_NAME = 'shifts';

export const SHIFT_TYPE = ['morning', 'afternoon', 'full_day'] as const;
export type ShiftType = (typeof SHIFT_TYPE)[number];

export const SHIFT_STATUS = ['active', 'archived'] as const;
export type ShiftStatus = (typeof SHIFT_STATUS)[number];

export interface IShift {
  name: string;
  type: ShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  workingDays: number[]; // ISO weekdays 1..7
  status: ShiftStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type ShiftDoc = HydratedDocument<IShift>;

const shiftSchema = new Schema<IShift>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: SHIFT_TYPE, default: 'full_day' },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakMinutes: { type: Number, default: 0, min: 0 },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    status: { type: String, enum: SHIFT_STATUS, default: 'active', index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Shift = mongoose.model<IShift>(DB_NAME, shiftSchema);
