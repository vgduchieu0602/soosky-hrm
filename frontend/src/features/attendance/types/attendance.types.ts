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
  /** Công this record contributes = 1/(số ca trong ngày). */
  congWeight?: number | null;
  lateMinutes: number;
  earlyMinutes: number;
  note?: string | null;
}

export interface RosterEmployee {
  _id: string;
  employeeCode: string;
  fullName: string;
  departmentName: string;
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

/**
 * HR nhập công cho MỘT ngày. Không có `shiftId`: backend nhận một cặp giờ
 * vào/ra rồi tự rải sang từng ca của ngày (`AttendanceDayWriter`) — client không
 * quyết định ca nào.
 */
export interface UpsertAttendanceInput {
  employeeId: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  note?: string | null;
}

export type CorrectionStatus = "pending" | "approved" | "rejected";

/** Yêu cầu chỉnh công: nhân viên gửi, HR/quản lý duyệt. */
export interface AttendanceCorrectionRecord {
  _id: string;
  employeeId: string;
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: CorrectionStatus;
  createdBy: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface SubmitCorrectionInput {
  date: string;
  reason: string;
  /** Bỏ trống = yêu cầu cho chính mình (backend suy ra từ access token). */
  employeeId?: string | null;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
}

export interface SubmitLeaveInput {
  /** Bỏ trống = đơn của chính mình; HR nộp thay thì truyền id nhân viên. */
  employeeId?: string | null;
  leaveType: LeaveTypeKey;
  startDate: string;
  endDate: string;
  halfDaySession?: "morning" | "afternoon" | null;
  reason?: string;
}
