import AccountController, { AccountControllerUseCases } from "@modules/auth/adapters/driver/http/controllers/AccountController";
import SessionController, { SessionControllerUseCases } from "@modules/auth/adapters/driver/http/controllers/SessionController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

export type { AuthSessionDTO } from "@modules/auth/adapters/driver/http/presenters/AuthSessionPresenter";

/**
 * Toàn bộ use-case mà driver adapter HTTP cần để phục vụ các endpoint
 * của module (ánh xạ 1:1 với docs/api.html § Auth).
 */
export type AuthHttpUseCases =
    & AccountControllerUseCases
    & SessionControllerUseCases;

/**
 * Driver adapter HTTP của module Auth.
 *
 * Giữ danh sách route duy nhất của module — nhìn một chỗ thấy toàn bộ bề mặt
 * API. Khác với task-mgmt, Auth trộn endpoint public (đăng ký, xác minh, đăng
 * nhập, refresh) và endpoint Bearer nên `authenticate` gắn theo từng route
 * thay vì áp cho cả router.
 */
export function createAuthHttpRouter(
    useCases: AuthHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const accounts = new AccountController(useCases);
    const sessions = new SessionController(useCases);

    const router   = Router();
    const withAuth = authenticate(accessTokenVerifier);

    router.use(json());

    // Account + Account Lifecycle (docs/api.html § Account, § Account Lifecycle)
    router.post  ("/accounts",                         withAuth, accounts.registerMemberAccount);
    router.get   ("/accounts",                         withAuth, accounts.listAccounts);
    router.post  ("/accounts/verification",                      accounts.verifyAccount);
    router.post  ("/accounts/:accountId/deactivation", withAuth, accounts.deactivateAccount);
    router.post  ("/accounts/:accountId/reactivation", withAuth, accounts.reactivateAccount);
    router.patch ("/accounts/:accountId/role",         withAuth, accounts.changeAccountRole);
    router.delete("/accounts/:accountId",              withAuth, accounts.deletePendingAccount);

    // Self account
    router.get   ("/me",                               withAuth, accounts.getMyAccount);
    router.patch ("/me/profile",                       withAuth, accounts.updateProfile);
    router.put   ("/me/password",                      withAuth, accounts.changePassword);

    // Session (docs/api.html § Session)
    router.post  ("/sessions",                                   sessions.login);
    router.post  ("/sessions/refresh",                           sessions.refreshSession);
    router.post  ("/sessions/logout",                  withAuth, sessions.logout);

    router.use(errorHandler);

    return router;
}
