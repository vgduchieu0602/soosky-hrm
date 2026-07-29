import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class SymbolCodeConflictError extends ApplicationError {
    readonly code       = "SYMBOL_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor() {
        super("Attendance symbol code already exists");
    }
}
