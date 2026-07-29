import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class RoleAssignmentExistsError extends ApplicationError {
    readonly code = "ROLE_ASSIGNMENT_EXISTS";
    readonly httpStatus = 409;

    constructor() {
        super("Role assignment already exists");
    }
}
