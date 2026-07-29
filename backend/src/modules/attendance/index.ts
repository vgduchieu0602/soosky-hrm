// API công khai của module Attendance.
// Chỉ những symbol export ở đây mới truy cập được từ các module khác.

export { createAttendanceHttpRouter } from "@modules/attendance/adapters/driver/http";
export type { AttendanceHttpUseCases } from "@modules/attendance/adapters/driver/http";
export { createAttendanceDirectory } from "@modules/attendance/composition";
export type { AttendanceDirectory, WorkdaySummary } from "@modules/attendance/composition";
