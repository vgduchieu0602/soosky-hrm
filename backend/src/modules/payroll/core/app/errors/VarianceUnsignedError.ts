import ApplicationError from "@shared/core/app/errors/ApplicationError";

/**
 * Kỳ còn chênh lệch giữa hai phiên bản công thức mà chưa ai giải thích và ký.
 *
 * 409 chứ không 403: không phải thiếu quyền, mà là còn việc phải làm.
 */
export default class VarianceUnsignedError extends ApplicationError {
    readonly code       = "PAYROLL_VARIANCE_UNSIGNED";
    readonly httpStatus = 409;

    constructor(count: number) {
        super(`${count} payroll variance(s) still need an explanation and sign-off`);
    }
}
