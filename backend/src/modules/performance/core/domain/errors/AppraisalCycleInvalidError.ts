import DomainError from "@shared/core/domain/DomainError";

export default class AppraisalCycleInvalidError extends DomainError {
    readonly code       = "APPRAISAL_CYCLE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
