import DomainError from "@shared/core/domain/DomainError";

export default class PayrollPeriodNameInvalidError extends DomainError {
    readonly code       = "PAYROLL_PERIOD_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
