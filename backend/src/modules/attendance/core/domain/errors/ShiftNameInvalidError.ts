import DomainError from "@shared/core/domain/DomainError";

export default class ShiftNameInvalidError extends DomainError {
    readonly code       = "SHIFT_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
