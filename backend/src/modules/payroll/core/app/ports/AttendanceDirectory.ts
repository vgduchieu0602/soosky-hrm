export interface WorkdaySummary {
    /** Ngày làm có lương (đi làm được tính công + nghỉ phép có lương). */
    actualWorkDays: number;
    /** Nghỉ không lương + vắng mặt. */
    unpaidDays:     number;
}

/**
 * Cổng tra cứu tổng hợp ngày công mà module Payroll cần — module Payroll
 * KHÔNG import trực tiếp module Attendance. Composition root (infra) lắp hiện
 * thực dựa trên `createAttendanceDirectory` của Attendance (mở rộng thêm hàm
 * đọc `getWorkdaySummary`).
 *
 * Giản lược: số ngày công CHUẨN của kỳ là MỘT số cấu hình ở cấp kỳ lương
 * (`PayrollPeriod.standardWorkDays`), áp dụng chung cho mọi nhân viên — không
 * suy ra theo ca làm việc từng người như bản cũ (xem payroll-report.md).
 */
export default interface AttendanceDirectory {
    getWorkdaySummary(employeeId: string, range: { from: Date; to: Date }): Promise<WorkdaySummary>;
}
