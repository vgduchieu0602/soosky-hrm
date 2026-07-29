import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class LeaveRequestNotFoundError extends ApplicationError {
    readonly code       = "LEAVE_REQUEST_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Leave request not found");
    }
}
