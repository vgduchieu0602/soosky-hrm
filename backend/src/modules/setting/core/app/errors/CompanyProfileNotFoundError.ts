import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class CompanyProfileNotFoundError extends ApplicationError {
    readonly code       = "COMPANY_PROFILE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Company profile not found");
    }
}
