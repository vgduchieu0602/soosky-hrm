import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class RoleNotFoundError extends ApplicationError {
    readonly code = "ROLE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Role not found");
    }
}
