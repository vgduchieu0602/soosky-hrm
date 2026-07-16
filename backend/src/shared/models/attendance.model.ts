import mongoose, { Schema, Types, type HydratedDocument } from 'mongoose';

const DB_NAME = 'attendance';
const COLLECTION_NAME = 'attendances';

export const ATTENDANCE_SESSION = ['morning', 'afternoon', 'full_day'] as const;
export type AttendanceSession = (typeof ATTENDANCE_SESSION)[number];

export const ATTENDANCE_STATUS = [
  'present',
  'late',
  'early_leave',
  'incomplete',
  'absent',
  'leave_paid',
  'leave_unpaid',
  'holiday',
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export interface IAttendance {
  employeeId: Types.ObjectId;
  date: Date; // 00:00 UTC of the VN calendar day this record belongs to
  session: AttendanceSession;
  shiftId?: Types.ObjectId | null;
  checkIn?: Date | null;
  checkOut?: Date | null;
  status: AttendanceStatus;
  workHours?: number | null;
  /** Công this record contributes to the day = 1 / (số ca cấu hình trong ngày),
   *  so N ca in a day always sum to 1.0 full day regardless of ca type. Null on
   *  legacy/leave rows → callers fall back to the session weight. */
  congWeight?: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  leaveRequestId?: Types.ObjectId | null; // set on records generated from an approved leave
  source: string; // 'manual' for HR-entered records, 'leave' for leave-generated
  note?: string | null;
  createdBy?: Types.ObjectId | null;
  adjustedBy?: Types.ObjectId | null;
  adjustedAt?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export type AttendanceDoc = HydratedDocument<IAttendance>;

const attendanceSchema = new Schema<IAttendance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'employees', required: true, index: true },
    date: { type: Date, required: true },
    session: { type: String, enum: ATTENDANCE_SESSION, default: 'full_day' },
    shiftId: { type: Schema.Types.ObjectId, ref: 'shifts', default: null },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    status: { type: String, enum: ATTENDANCE_STATUS, required: true, index: true },
    workHours: { type: Number, default: null },
    congWeight: { type: Number, default: null },
    lateMinutes: { type: Number, default: 0 },
    earlyMinutes: { type: Number, default: 0 },
    leaveRequestId: { type: Schema.Types.ObjectId, ref: 'leaveRequests', default: null, index: true },
    source: { type: String, default: 'manual' },
    note: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    adjustedBy: { type: Schema.Types.ObjectId, ref: 'users', default: null },
    adjustedAt: { type: Date, default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  },
);

// One record per employee / day / shift (ca). Each day can have N ca, one
// record each. Partial so missing shiftId never collides.
attendanceSchema.index(
  { employeeId: 1, date: 1, shiftId: 1 },
  { unique: true, partialFilterExpression: { shiftId: { $type: 'objectId' } } },
);
attendanceSchema.index({ date: 1 });

export const Attendance = mongoose.model<IAttendance>(DB_NAME, attendanceSchema);
