/**
 * Public surface of the Auth module — login, logout, refresh, sessions, JWT
 * issuance and the single-use password-setup links.
 *
 * Auth answers "who is this user?". It authenticates against the identity
 * store IAM owns and holds no HRM business logic.
 */
export { default as authRouter } from '@modules/auth/adapters/http/auth.routes';

export {
  authUseCases as authService,
  passwordSetupUseCases as passwordSetupService,
  tokenService,
} from '@modules/auth/adapters/container';

// Session repository, for callers that must revoke a user's sessions inside
// their own transaction (employee off-boarding in HRM).
export { sessionRepo as sessionRepository } from '@modules/auth/adapters/container';

export { buildSetPasswordUrl } from '@modules/auth/core/app/use-cases/password-setup.usecases';

export type { AuthenticatedUser, LoginResult } from '@modules/auth/core/app/use-cases/auth.usecases';
