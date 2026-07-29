import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PayrollPeriodNotFoundError extends ApplicationError {
    readonly code       = "PAYROLL_PERIOD_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Payroll period not found");
    }
}
