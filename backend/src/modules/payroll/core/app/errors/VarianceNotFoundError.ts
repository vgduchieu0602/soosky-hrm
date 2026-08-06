import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class VarianceNotFoundError extends ApplicationError {
    readonly code       = "PAYROLL_VARIANCE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("No variance recorded for this employee in this period");
    }
}
