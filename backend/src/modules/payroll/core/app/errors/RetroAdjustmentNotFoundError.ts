import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class RetroAdjustmentNotFoundError extends ApplicationError {
    readonly code       = "RETRO_ADJUSTMENT_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Retro adjustment not found");
    }
}
