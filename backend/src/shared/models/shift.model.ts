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
  /** Công weight this ca contributes to a day: morning|afternoon = 0.5, full_day = 1. */
  weight: number;
  workingDays: number[]; // ISO weekdays 1..7
  /** Seasonal validity window (inclusive, calendar date). Unset on both = applies year-round. */
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  status: ShiftStatus;
  created_at?: Date;
  updated_at?: Date;
}

export type ShiftDoc = HydratedDocument<IShift>;

/** Default công weight for a ca when not explicitly set — derived from its type. */
export function defaultWeightForType(type: ShiftType): number {
  return type === 'full_day' ? 1 : 0.5;
}

const shiftSchema = new Schema<IShift>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: SHIFT_TYPE, default: 'full_day' },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakMinutes: { type: Number, default: 0, min: 0 },
    // Công weight; when unset the matcher derives it from `type` via defaultWeightForType.
    weight: { type: Number, min: 0, max: 1 },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
    effectiveFrom: { type: Date, default: null },
    effectiveTo: { type: Date, default: null },
    status: { type: String, enum: SHIFT_STATUS, default: 'active', index: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Shift = mongoose.model<IShift>(DB_NAME, shiftSchema);
