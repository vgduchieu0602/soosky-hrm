import DomainError from "@shared/core/domain/DomainError";

export default class ShiftTimeInvalidError extends DomainError {
    readonly code       = "SHIFT_TIME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
