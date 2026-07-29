import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class NoApplicableShiftError extends ApplicationError {
    readonly code       = "NO_APPLICABLE_SHIFT";
    readonly httpStatus = 404;

    constructor() {
        super("No active shift applies to this weekday");
    }
}
