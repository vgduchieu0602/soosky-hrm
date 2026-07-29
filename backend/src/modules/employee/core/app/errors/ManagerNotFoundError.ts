import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ManagerNotFoundError extends ApplicationError {
    readonly code       = "MANAGER_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Manager not found");
    }
}
