import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class LeaveOverlapError extends ApplicationError {
    readonly code       = "LEAVE_OVERLAP";
    readonly httpStatus = 409;

    constructor() {
        super("Another leave request already covers a day in this range");
    }
}
