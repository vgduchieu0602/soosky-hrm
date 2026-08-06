/** Tiến độ chu kỳ đánh giá gắn với một kỳ lương. */
export interface EvaluationProgress {
    cycleId:            string;
    cycleStatus:        string;
    lockedCount:        number;
    /** Nhân viên đang làm việc mà điểm chưa khoá. */
    pendingEmployeeIds: string[];
}

/**
 * Cổng tra cứu tiến độ đánh giá, do module Performance sở hữu.
 *
 * Payroll dùng nó CHỈ để trả lời "kỳ này đã đủ điểm chưa" trước khi chốt đánh
 * giá. Điểm thật thì Payroll đọc từ bản chụp trong kỳ lương của mình, không đọc
 * qua cổng này — đó là điều giữ cho lương đã tính không đổi khi tiêu chí bị sửa.
 */
export default interface EvaluationDirectory {
    /** `undefined` khi kỳ lương này không gắn chu kỳ đánh giá nào. */
    progressForPayrollPeriod(payrollPeriodId: string): Promise<EvaluationProgress | undefined>;
}
