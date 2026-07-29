import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PayslipAlreadyFinalizedError extends ApplicationError {
    readonly code       = "PAY_ALREADY_FINALIZED";
    readonly httpStatus = 409;

    constructor(status: string) {
        super(`Payslip is ${status}; recompute not allowed`);
    }
}
