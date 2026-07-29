import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class LeaveRequestNotApprovedError extends ApplicationError {
    readonly code       = "LEAVE_REQUEST_NOT_APPROVED";
    readonly httpStatus = 409;

    constructor() {
        super("Only an approved leave request can be revoked");
    }
}
