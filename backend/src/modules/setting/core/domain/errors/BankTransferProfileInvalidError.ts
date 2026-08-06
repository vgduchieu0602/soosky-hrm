import DomainError from "@shared/core/domain/DomainError";

export default class BankTransferProfileInvalidError extends DomainError {
    readonly code       = "BANK_TRANSFER_PROFILE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
