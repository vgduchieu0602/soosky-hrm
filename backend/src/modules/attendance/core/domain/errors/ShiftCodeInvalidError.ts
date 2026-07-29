import DomainError from "@shared/core/domain/DomainError";

export default class ShiftCodeInvalidError extends DomainError {
    readonly code       = "SHIFT_CODE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
