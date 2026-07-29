import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ShiftNotFoundError extends ApplicationError {
    readonly code       = "SHIFT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Shift not found");
    }
}
