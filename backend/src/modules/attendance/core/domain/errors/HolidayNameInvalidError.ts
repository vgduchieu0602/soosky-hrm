import DomainError from "@shared/core/domain/DomainError";

export default class HolidayNameInvalidError extends DomainError {
    readonly code       = "HOLIDAY_NAME_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
