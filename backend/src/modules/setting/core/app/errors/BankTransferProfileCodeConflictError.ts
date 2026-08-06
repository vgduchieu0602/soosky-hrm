import ApplicationError from "@shared/core/app/errors/ApplicationError";

export default class BankTransferProfileCodeConflictError extends ApplicationError {
    readonly code       = "BANK_TRANSFER_PROFILE_CODE_CONFLICT";
    readonly httpStatus = 409;

    constructor(bankCode: string) {
        super(`Bank transfer profile '${bankCode}' already exists`);
    }
}
