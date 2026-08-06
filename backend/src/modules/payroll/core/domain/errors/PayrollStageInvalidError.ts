import DomainError from "@shared/core/domain/DomainError";

/**
 * Thao tác không hợp lệ ở bước hiện tại của kỳ lương.
 *
 * Khác `PayrollPeriodLockedError` (kỳ đã đóng/đã chi, không làm gì được nữa):
 * lỗi này nói "làm sai THỨ TỰ" — ví dụ bấm duyệt khi HR chưa soát xong.
 */
export default class PayrollStageInvalidError extends DomainError {
    readonly code       = "PAYROLL_STAGE_INVALID";
    readonly httpStatus = 409;

    constructor(action: string, current: string, expected: readonly string[]) {
        super(`Cannot ${action} while period stage is "${current}"; expected one of: ${expected.join(", ")}`);
    }
}
