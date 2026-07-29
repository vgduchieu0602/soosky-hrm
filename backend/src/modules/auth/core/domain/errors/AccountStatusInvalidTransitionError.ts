import { AccountStatus } from "@modules/auth/core/domain/entities/Account";
import DomainError from "@shared/core/domain/DomainError";

export default class AccountStatusInvalidTransitionError extends DomainError {
    readonly code = "ACCOUNT_STATUS_INVALID_TRANSITION";
    readonly httpStatus = 422;

    constructor(from: AccountStatus, to: AccountStatus) {
        super(`Cannot move account from "${from}" to "${to}"`);
    }
}
