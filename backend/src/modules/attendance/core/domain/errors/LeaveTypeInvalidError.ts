import DomainError from "@shared/core/domain/DomainError";

export default class LeaveTypeInvalidError extends DomainError {
    readonly code       = "LEAVE_TYPE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
