export type AttendanceStatus =
  | "present"
  | "late"
  | "early_leave"
  | "incomplete"
  | "absent"
  | "leave_paid"
  | "leave_unpaid"
  | "holiday";

export type AttendanceSession = "morning" | "afternoon" | "full_day";

export interface AttendanceRecord {
  _id: string;
  employeeId: string;
  date: string; // ISO date-key
  session: AttendanceSession;
  shiftId?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  status: AttendanceStatus;
  workHours: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  note?: string | null;
}

export interface RosterEmployee {
  _id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  /** Remaining annual leave for the current year (entitled − used). */
  annualLeaveRemaining?: number;
  /** Whole months the employee has worked at the company. */
  tenureMonths?: number;
}

export interface AdminGrid {
  month: string;
  employees: RosterEmployee[];
  shifts: ShiftOption[];
  records: AttendanceRecord[];
}

export interface MyMonth {
  employeeId: string;
  month: string;
  records: AttendanceRecord[];
}

export type LeaveTypeKey =
  | "annual"
  | "sick"
  | "personal"
  | "unpaid"
  | "maternity"
  | "paternity";

export type LeaveStatusKey = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequestRecord {
  _id: string;
  employeeId: string;
  employeeCode?: string;
  fullName?: string;
  leaveType: LeaveTypeKey;
  startDate: string;
  endDate: string;
  days: number;
  halfDaySession?: "morning" | "afternoon" | null;
  reason?: string | null;
  status: LeaveStatusKey;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  created_at?: string;
}

export interface LeaveBalanceRecord {
  _id: string;
  employeeId: string;
  leaveType: LeaveTypeKey;
  year: number;
  entitled: number;
  used: number;
}

export interface ShiftOption {
  _id: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  status?: string;
}

export interface UpsertAttendanceInput {
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  checkIn?: string | null;
  checkOut?: string | null;
  status?: "leave_paid" | "leave_unpaid" | "holiday" | "absent";
  note?: string | null;
}

export interface SubmitLeaveInput {
  leaveType: LeaveTypeKey;
  startDate: string;
  endDate: string;
  halfDaySession?: "morning" | "afternoon" | null;
  reason?: string;
}
