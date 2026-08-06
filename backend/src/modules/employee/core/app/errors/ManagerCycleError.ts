import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ManagerCycleError extends ApplicationError {
    readonly code       = "MANAGER_CYCLE";
    readonly httpStatus = 409;

    constructor() {
        super("Assigning this manager would create a cycle in the reporting chain");
    }
}
