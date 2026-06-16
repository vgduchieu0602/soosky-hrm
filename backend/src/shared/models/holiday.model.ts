import mongoose, { Schema, type HydratedDocument } from 'mongoose';

const DB_NAME = 'holiday';
const COLLECTION_NAME = 'holidays';

export interface IHoliday {
  name: string;
  date: Date;
  isRecurring: boolean;
  country: string; // ISO code or '*' for global
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export type HolidayDoc = HydratedDocument<IHoliday>;

const holidaySchema = new Schema<IHoliday>(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    isRecurring: { type: Boolean, default: false },
    country: { type: String, default: '*', uppercase: true, trim: true },
    description: { type: String, trim: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

export const Holiday = mongoose.model<IHoliday>(DB_NAME, holidaySchema);
