import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class RoleAssignmentNotFoundError extends ApplicationError {
    readonly code = "ROLE_ASSIGNMENT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Role assignment not found");
    }
}
