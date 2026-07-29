import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PositionCodeConflictError extends ApplicationError {
    readonly code       = "POSITION_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Position code already exists");
    }
}
