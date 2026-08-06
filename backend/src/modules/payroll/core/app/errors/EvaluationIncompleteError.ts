import ApplicationError from "@shared/core/app/errors/ApplicationError";

/** Nhân viên chưa có đủ điểm hiệu suất và mục tiêu đã chốt cho kỳ lương. */
export default class EvaluationIncompleteError extends ApplicationError {
    readonly code       = "PAY_EVALUATION_INCOMPLETE";
    readonly httpStatus = 409;

    constructor(employeeId: string) {
        super(`Evaluation is incomplete for employee ${employeeId}`);
    }
}
