import DomainError from "@shared/core/domain/DomainError";

export default class PositionCodeInvalidError extends DomainError {
    readonly code       = "POSITION_CODE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
