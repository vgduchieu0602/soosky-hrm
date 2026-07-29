import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ShiftCodeConflictError extends ApplicationError {
    readonly code       = "SHIFT_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Shift code already exists");
    }
}
