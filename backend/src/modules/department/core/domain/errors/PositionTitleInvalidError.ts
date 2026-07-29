import DomainError from "@shared/core/domain/DomainError";

export default class PositionTitleInvalidError extends DomainError {
    readonly code       = "POSITION_TITLE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
