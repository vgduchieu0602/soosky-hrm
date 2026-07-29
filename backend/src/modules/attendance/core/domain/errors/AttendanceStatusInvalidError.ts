import DomainError from "@shared/core/domain/DomainError";

export default class AttendanceStatusInvalidError extends DomainError {
    readonly code       = "ATTENDANCE_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
