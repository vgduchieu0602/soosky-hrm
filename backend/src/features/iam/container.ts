/**
 * Composition root — the only place that knows about concrete adapters.
 * Wires infrastructure implementations into the application use-cases and
 * exposes them as a ready-to-use container for the HTTP layer + cross-feature
 * consumers.
 */
import { MongooseUserRepository } from '@features/iam/infrastructure/user.repository.mongoose';
import { MongooseRoleRepository } from '@features/iam/infrastructure/role.repository.mongoose';
import { MongoosePermissionRepository } from '@features/iam/infrastructure/permission.repository.mongoose';
import { MongooseSessionRepository } from '@features/iam/infrastructure/session.repository.mongoose';
import { MongooseAuditLogRepository } from '@features/iam/infrastructure/audit-log.repository.mongoose';
import { MongoosePasswordSetupTokenRepository } from '@features/iam/infrastructure/password-setup-token.repository.mongoose';
import {
  SystemClock,
  BcryptPasswordHasher,
  RefreshTokenHasherAdapter,
  CryptoTokenHasher,
  ObjectIdValidator,
  EventBusAdapter,
} from '@features/iam/infrastructure/services';
import { tokenService } from '@features/iam/services/token.service';
import { AuthUseCases } from '@features/iam/application/auth.usecases';
import { UserUseCases } from '@features/iam/application/user.usecases';
import { RoleUseCases } from '@features/iam/application/role.usecases';
import { PermissionUseCases } from '@features/iam/application/permission.usecases';
import { AuditUseCases } from '@features/iam/application/audit.usecases';
import { PasswordSetupUseCases } from '@features/iam/application/password-setup.usecases';

// --- infrastructure ---
const userRepo = new MongooseUserRepository();
const roleRepo = new MongooseRoleRepository();
const permissionRepo = new MongoosePermissionRepository();
const sessionRepo = new MongooseSessionRepository();
const auditLogRepo = new MongooseAuditLogRepository();
const passwordSetupTokenRepo = new MongoosePasswordSetupTokenRepository();

const clock = new SystemClock();
const passwordHasher = new BcryptPasswordHasher();
const refreshHasher = new RefreshTokenHasherAdapter();
const tokenHasher = new CryptoTokenHasher();
const idValidator = new ObjectIdValidator();
const events = new EventBusAdapter();

// --- application ---
export const auditUseCases = new AuditUseCases(auditLogRepo);

export const authUseCases = new AuthUseCases(
  userRepo, roleRepo, permissionRepo, sessionRepo, tokenService,
  passwordHasher, refreshHasher, auditUseCases, events, clock,
);
export const userUseCases = new UserUseCases(userRepo, passwordHasher, auditUseCases);
export const roleUseCases = new RoleUseCases(roleRepo, auditUseCases);
export const permissionUseCases = new PermissionUseCases(permissionRepo, auditUseCases);
export const passwordSetupUseCases = new PasswordSetupUseCases(
  passwordSetupTokenRepo, userRepo, sessionRepo, passwordHasher, tokenHasher,
  auditUseCases, events, clock, idValidator,
);

// Concrete adapters exposed for cross-feature deep-import compatibility shims.
export { sessionRepo, tokenService };
