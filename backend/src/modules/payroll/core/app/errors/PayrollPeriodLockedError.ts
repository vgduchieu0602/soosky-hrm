import ApplicationError from "@shared/core/app/errors/ApplicationError";

/** Kỳ lương đang ở trạng thái không cho phép thao tác này (đã `closed`/`paid`, …). */
export default class PayrollPeriodLockedError extends ApplicationError {
    readonly code       = "PAYROLL_PERIOD_LOCKED";
    readonly httpStatus = 409;

    constructor(reason: string) {
        super(reason);
    }
}
