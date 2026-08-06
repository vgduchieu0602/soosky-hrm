import ApplicationError from "@shared/core/app/errors/ApplicationError";

/**
 * Chu kỳ chưa đủ điều kiện để đóng: còn nhân viên đang làm việc chưa có điểm
 * đã khoá. Chặn ở đây để bảng lương không bao giờ chạy trên chu kỳ dở dang.
 */
export default class CycleNotReadyError extends ApplicationError {
    readonly code       = "APPRAISAL_CYCLE_NOT_READY";
    readonly httpStatus = 409;

    constructor(pendingCount: number) {
        super(`${pendingCount} employee(s) still have no locked score in this cycle`);
    }
}
