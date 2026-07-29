import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PayslipNotApprovedError extends ApplicationError {
    readonly code       = "PAY_NOT_APPROVED";
    readonly httpStatus = 409;

    constructor(status: string) {
        super(`Only an approved payslip can be reverted (current: ${status})`);
    }
}
