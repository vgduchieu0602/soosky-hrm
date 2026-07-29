import DomainError from "@shared/core/domain/DomainError";

export default class AccountRoleInvalidError extends DomainError {
    readonly code = "ACCOUNT_ROLE_INVALID";
    readonly httpStatus = 422;

    constructor(value: string) {
        super(`Invalid account role: ${value}`);
    }
}
