import DomainError from "@shared/core/domain/DomainError";

export default class PositionStatusInvalidError extends DomainError {
    readonly code       = "POSITION_STATUS_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
