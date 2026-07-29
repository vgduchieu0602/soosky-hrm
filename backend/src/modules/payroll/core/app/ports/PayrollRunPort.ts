export interface PayrollRunResult {
    computed: number;
    errors:   { employeeId: string; reason: string }[];
}

/**
 * Cổng kích hoạt chạy lương cả kỳ — cho phép use-case khoá kỳ (lock
 * attendance/evaluations) tự động chạy lương khi cả hai chốt đã xong, mà
 * không phụ thuộc trực tiếp vào lớp `RunPayrollForPeriodUseCase` cụ thể.
 */
export default interface PayrollRunPort {
    forPeriod(periodId: string, actorUserId: string): Promise<PayrollRunResult>;
}
