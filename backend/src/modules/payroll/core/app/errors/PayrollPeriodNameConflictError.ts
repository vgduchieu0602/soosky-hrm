import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PayrollPeriodNameConflictError extends ApplicationError {
    readonly code       = "PAYROLL_PERIOD_NAME_CONFLICT";
    readonly httpStatus = 409;

    constructor(name: string) {
        super(`Payroll period '${name}' already exists`);
    }
}
