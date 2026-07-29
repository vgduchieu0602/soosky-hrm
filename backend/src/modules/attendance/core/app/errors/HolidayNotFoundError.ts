import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class HolidayNotFoundError extends ApplicationError {
    readonly code       = "HOLIDAY_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Holiday not found");
    }
}
