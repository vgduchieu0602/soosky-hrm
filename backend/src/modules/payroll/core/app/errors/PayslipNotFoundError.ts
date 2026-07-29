import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PayslipNotFoundError extends ApplicationError {
    readonly code       = "PAYSLIP_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Payslip not found");
    }
}
