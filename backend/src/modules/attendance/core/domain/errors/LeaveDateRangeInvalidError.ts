import DomainError from "@shared/core/domain/DomainError";

/** Khoảng ngày nghỉ không hợp lệ: kết thúc trước bắt đầu, nửa ngày trải nhiều ngày, hoặc không có ngày làm việc nào trong khoảng. */
export default class LeaveDateRangeInvalidError extends DomainError {
    readonly code       = "LEAVE_DATE_RANGE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
