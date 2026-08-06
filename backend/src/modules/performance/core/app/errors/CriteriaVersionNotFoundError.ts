import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class CriteriaVersionNotFoundError extends ApplicationError {
    readonly code       = "CRITERIA_VERSION_NOT_FOUND";
    readonly httpStatus = 404;

    constructor(version: number) {
        super(`Criteria version ${version} not found`);
    }
}
