/** Tên collection MongoDB của module Attendance (đặt tiền tố `att_`). */
export const ATTENDANCE_COLLECTIONS = {
    shifts:          "att_shifts",
    holidays:        "att_holidays",
    symbols:         "att_symbols",
    attendances:     "att_attendances",
    leaveRequests:   "att_leave_requests",
    leaveBalances:   "att_leave_balances",
} as const;
