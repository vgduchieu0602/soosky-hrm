import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class LeaveQuotaExceededError extends ApplicationError {
    readonly code       = "LEAVE_QUOTA_EXCEEDED";
    readonly httpStatus = 409;

    constructor(message: string) {
        super(message);
    }
}
