import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PayrollPeriodDraftRemainingError extends ApplicationError {
    readonly code       = "PAY_DRAFT_REMAINING";
    readonly httpStatus = 409;

    constructor(draftCount: number) {
        super(`${draftCount} payroll row(s) still draft — approve or revert them first`);
    }
}
