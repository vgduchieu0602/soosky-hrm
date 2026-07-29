import DomainError from "@shared/core/domain/DomainError";

export default class SuperAdminRoleImmutableError extends DomainError {
    readonly code = "SUPER_ADMIN_ROLE_IMMUTABLE";
    readonly httpStatus = 409;

    constructor() {
        super("The super admin role cannot be granted or revoked");
    }
}
