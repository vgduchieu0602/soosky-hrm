import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class NothingToPayError extends ApplicationError {
    readonly code       = "PAY_NOTHING_TO_PAY";
    readonly httpStatus = 409;

    constructor() {
        super("No approved payslip to mark as paid");
    }
}
