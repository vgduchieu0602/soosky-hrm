import DomainError from "@shared/core/domain/DomainError";

/**
 * Chuyển trạng thái phiếu đánh giá không hợp lệ (vd: duyệt phiếu chưa chấm,
 * khoá phiếu chưa được xác nhận). 409 vì đây là xung đột trạng thái, không
 * phải dữ liệu sai định dạng.
 */
export default class PerformanceReviewTransitionError extends DomainError {
    readonly code       = "PERFORMANCE_REVIEW_TRANSITION_INVALID";
    readonly httpStatus = 409;

    constructor(from: string, action: string) {
        super(`Cannot ${action} a review in status "${from}"`);
    }
}
