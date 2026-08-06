import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class BankTransferProfileNotFoundError extends ApplicationError {
    readonly code       = "BANK_TRANSFER_PROFILE_NOT_FOUND";
    readonly httpStatus = 404;

    constructor() {
        super("Bank transfer profile not found");
    }
}
