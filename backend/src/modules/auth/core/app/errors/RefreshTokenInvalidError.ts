import ApplicationError from "@shared/core/app/errors/ApplicationError";

export class RefreshTokenInvalidError extends ApplicationError {
    readonly code = "REFRESH_TOKEN_INVALID";
    readonly httpStatus = 401;

    constructor() {
        super("Refresh token is invalid, expired, or revoked");
    }
}
