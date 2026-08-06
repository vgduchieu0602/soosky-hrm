import DomainError from "@shared/core/domain/DomainError";

export default class CriteriaSetInvalidError extends DomainError {
    readonly code       = "CRITERIA_SET_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
