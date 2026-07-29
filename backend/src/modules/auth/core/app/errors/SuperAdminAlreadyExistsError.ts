import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class SuperAdminAlreadyExistsError extends ApplicationError {
    readonly code = "SUPER_ADMIN_ALREADY_EXISTS";
    readonly httpStatus = 409;

    constructor() {
        super("A super admin account already exists");
    }
}
