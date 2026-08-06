import DomainError from "@shared/core/domain/DomainError";

export default class AttendanceCorrectionInvalidError extends DomainError {
    readonly code       = "ATTENDANCE_CORRECTION_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
