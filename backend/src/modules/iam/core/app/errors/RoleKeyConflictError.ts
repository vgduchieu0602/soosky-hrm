import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class RoleKeyConflictError extends ApplicationError {
    readonly code = "ROLE_KEY_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Role key already in use");
    }
}
