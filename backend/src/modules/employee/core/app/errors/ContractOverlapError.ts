import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ContractOverlapError extends ApplicationError {
    readonly code       = "EMPLOYEE_CONTRACT_OVERLAP";
    readonly httpStatus = 409;

    constructor(conflictingContractNumber: string) {
        super(`Another active contract (${conflictingContractNumber}) already covers this period`);
    }
}
