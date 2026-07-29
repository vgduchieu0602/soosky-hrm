import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PayrollPeriodHasDataError extends ApplicationError {
    readonly code       = "PAYROLL_PERIOD_HAS_DATA";
    readonly httpStatus = 409;

    constructor() {
        super("Period already has payroll rows — cannot delete. Revert payrolls first");
    }
}
