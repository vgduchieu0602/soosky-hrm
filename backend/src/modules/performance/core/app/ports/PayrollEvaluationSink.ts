/**
 * Cổng CHỤP điểm đã khoá vào kỳ lương, do module Payroll sở hữu.
 *
 * Đây là toàn bộ mặt tiếp xúc giữa Performance và Payroll, và cố ý một chiều:
 * Performance ĐẨY một bản chụp bất biến sang; Payroll lưu bản chụp đó trong kỳ
 * lương của mình và không bao giờ đọc lại phiếu đánh giá. Nhờ vậy sửa tiêu chí,
 * chấm lại hay phát hành phiên bản mới về sau KHÔNG làm đổi lương đã tính.
 */
export default interface PayrollEvaluationSink {
    /**
     * Ghi (hoặc ghi lại) điểm của một nhân viên vào kỳ lương.
     *
     * @throws {ApplicationError} Kỳ lương không tồn tại, hoặc đã chốt đánh giá
     *         (không nhận thêm bản chụp — muốn đổi phải mở khoá kỳ).
     */
    snapshotEvaluation(input: {
        payrollPeriodId:  string;
        employeeId:       string;
        performanceScore: number;
        goalScore:        number;
        updatedBy:        string;
    }): Promise<void>;
}
