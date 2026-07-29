import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class RoleIsSystemError extends ApplicationError {
    readonly code = "ROLE_IS_SYSTEM";
    readonly httpStatus = 409;

    constructor() {
        super("System role cannot be modified or deleted");
    }
}
