import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class PositionNotFoundError extends ApplicationError {
    readonly code       = "POSITION_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Position not found");
    }
}
