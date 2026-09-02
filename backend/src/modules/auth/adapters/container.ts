/**
 * Auth composition root — the only place that knows about concrete adapters.
 *
 * Sessions, tokens and password-setup links are Auth's own adapters; the
 * user / role / permission repositories come from IAM, which owns the identity
 * store Auth authenticates against.
 */
import { userRepository, roleRepository, permissionRepository, auditService } from '@modules/iam';
import { MongooseSessionRepository } from '@modules/auth/adapters/persistence/session.repository';
import { MongoosePasswordSetupTokenRepository } from '@modules/auth/adapters/persistence/password-setup-token.repository';
import {
  SystemClock,
  BcryptPasswordHasher,
  RefreshTokenHasherAdapter,
  CryptoTokenHasher,
  ObjectIdValidator,
  EventBusAdapter,
} from '@modules/auth/adapters/security/services';
import { tokenService } from '@modules/auth/adapters/security/token.service';
import { AuthUseCases } from '@modules/auth/core/app/use-cases/auth.usecases';
import { PasswordSetupUseCases } from '@modules/auth/core/app/use-cases/password-setup.usecases';

// --- adapters ---
const sessionRepo = new MongooseSessionRepository();
const passwordSetupTokenRepo = new MongoosePasswordSetupTokenRepository();

const clock = new SystemClock();
const passwordHasher = new BcryptPasswordHasher();
const refreshHasher = new RefreshTokenHasherAdapter();
const tokenHasher = new CryptoTokenHasher();
const idValidator = new ObjectIdValidator();
const events = new EventBusAdapter();

// --- use-cases ---
export const authUseCases = new AuthUseCases(
  userRepository, roleRepository, permissionRepository, sessionRepo, tokenService,
  passwordHasher, refreshHasher, auditService, events, clock,
);

export const passwordSetupUseCases = new PasswordSetupUseCases(
  passwordSetupTokenRepo, userRepository, sessionRepo, passwordHasher, tokenHasher,
  auditService, events, clock, idValidator,
);

// Exposed for callers that must revoke a user's sessions inside their own
// transaction (employee off-boarding in HRM).
export { sessionRepo, tokenService };
