import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class NothingToApproveError extends ApplicationError {
    readonly code       = "PAY_NOTHING_TO_APPROVE";
    readonly httpStatus = 409;

    constructor() {
        super("No draft payslip to approve");
    }
}
