import DomainError from "@shared/core/domain/DomainError";

export default class PositionLevelInvalidError extends DomainError {
    readonly code       = "POSITION_LEVEL_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
