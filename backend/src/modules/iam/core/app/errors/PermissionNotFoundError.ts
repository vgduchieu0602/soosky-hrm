import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class PermissionNotFoundError extends ApplicationError {
    readonly code = "PERMISSION_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Permission not found");
    }
}
