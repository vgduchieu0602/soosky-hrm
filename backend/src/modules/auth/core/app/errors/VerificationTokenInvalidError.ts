import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class VerificationTokenInvalidError extends ApplicationError {
    readonly code = "VERIFICATION_TOKEN_INVALID";
    readonly httpStatus = 410;

    constructor() {
        super("Verification token is invalid or has expired");
    }
}
