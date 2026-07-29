import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class SymbolNotFoundError extends ApplicationError {
    readonly code       = "SYMBOL_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Attendance symbol not found");
    }
}
