import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class ImportChecksumMismatchError extends ApplicationError {
    readonly code       = "EMPLOYEE_IMPORT_CHECKSUM_MISMATCH";
    readonly httpStatus = 409;

    constructor() {
        super("CSV content changed since preview — run the preview again before committing");
    }
}
