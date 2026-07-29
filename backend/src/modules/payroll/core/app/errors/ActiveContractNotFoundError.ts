import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ActiveContractNotFoundError extends ApplicationError {
    readonly code       = "ACTIVE_CONTRACT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor(employeeId: string) {
        super(`No active contract found for employee ${employeeId}`);
    }
}
