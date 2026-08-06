/** Kỳ công đã chốt đang phủ một ngày cụ thể. */
export interface LockedPeriodInfo {
    periodId: string;
    name:     string;
}

/**
 * Cổng tra cứu trạng thái CHỐT kỳ công, do module Payroll sở hữu.
 *
 * Vì sao Attendance cần biết: chốt chấm công là mốc "số liệu đầu vào của lương
 * đã đông cứng". Sau mốc đó mọi thao tác ghi bảng công phải bị chặn, nếu không
 * bảng lương đã tính sẽ lệch với dữ liệu chấm công mà không ai hay. Muốn sửa
 * thì phải đi qua luồng mở khoá có quyền (`POST /payroll/periods/:id/unlock-attendance`).
 *
 * Composition root (infra) lắp hiện thực dựa trên `createPayrollPeriodLockDirectory`
 * của module Payroll.
 */
export default interface AttendancePeriodLockDirectory {
    /**
     * Kỳ ĐÃ CHỐT chấm công phủ ngày này, hoặc `undefined` nếu ngày này còn mở.
     * Ngày không thuộc kỳ nào cũng coi là mở.
     */
    findLockedPeriodCovering(date: Date): Promise<LockedPeriodInfo | undefined>;
}
