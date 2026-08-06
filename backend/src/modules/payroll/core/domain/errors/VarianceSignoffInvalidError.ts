import DomainError from "@shared/core/domain/DomainError";

export default class VarianceSignoffInvalidError extends DomainError {
    readonly code       = "PAYROLL_VARIANCE_SIGNOFF_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
