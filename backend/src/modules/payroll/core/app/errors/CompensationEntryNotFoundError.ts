import ApplicationError from "@shared/core/app/errors/ApplicationError";

/** Dùng chung cho Allowance/Bonus/Deduction không tìm thấy — tái dùng một class như `HolidayNotFoundError` style. */
export default class CompensationEntryNotFoundError extends ApplicationError {
    readonly code       = "COMPENSATION_ENTRY_NOT_FOUND";
    readonly httpStatus = 404;

    constructor(kind: string) {
        super(`${kind} not found`);
    }
}
