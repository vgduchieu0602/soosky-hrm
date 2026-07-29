import DomainError from "@shared/core/domain/DomainError";

export default class ShiftStatusInvalidError extends DomainError {
    readonly code       = "SHIFT_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
