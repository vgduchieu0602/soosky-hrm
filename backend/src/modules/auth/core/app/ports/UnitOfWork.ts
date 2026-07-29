import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import RefreshTokenStore from "@modules/auth/core/app/ports/RefreshTokenStore";
import VerificationTokenStore from "@modules/auth/core/app/ports/VerificationTokenStore";
import { UnitOfWork as BaseUnitOfWork } from "@shared/ports/UnitOfWork";

/**
 * Bộ cổng driven mà use-case Auth được cấp bên trong một `UnitOfWork.run` —
 * mọi thao tác ghi qua các cổng này là nguyên tử với nhau.
 */
export interface AuthUoWContext {
    accountRepo:            AccountRepo;
    refreshTokenStore:      RefreshTokenStore;
    verificationTokenStore: VerificationTokenStore;
}

export default interface UnitOfWork extends BaseUnitOfWork<AuthUoWContext> {}
