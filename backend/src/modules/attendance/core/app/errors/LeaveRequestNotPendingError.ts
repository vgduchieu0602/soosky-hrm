import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class LeaveRequestNotPendingError extends ApplicationError {
    readonly code       = "LEAVE_REQUEST_NOT_PENDING";
    readonly httpStatus = 409;

    constructor() {
        super("Leave request has already been decided");
    }
}
