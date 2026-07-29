import DomainError from "@shared/core/domain/DomainError";

export default class LeaveStatusInvalidError extends DomainError {
    readonly code       = "LEAVE_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
