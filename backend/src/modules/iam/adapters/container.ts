/**
 * IAM composition root — the only place that knows about concrete adapters.
 * Wires the Mongoose repositories into the IAM use-cases.
 *
 * IAM depends on no other business module: it is the identity store the whole
 * platform (HRM today, other products later) authorises against.
 */
import { MongooseUserRepository } from '@modules/iam/adapters/persistence/user.repository';
import { MongooseRoleRepository } from '@modules/iam/adapters/persistence/role.repository';
import { MongoosePermissionRepository } from '@modules/iam/adapters/persistence/permission.repository';
import { MongooseAuditLogRepository } from '@modules/iam/adapters/persistence/audit-log.repository';
import { BcryptPasswordHasher } from '@modules/iam/adapters/services';
import { UserUseCases } from '@modules/iam/core/app/use-cases/user.usecases';
import { RoleUseCases } from '@modules/iam/core/app/use-cases/role.usecases';
import { PermissionUseCases } from '@modules/iam/core/app/use-cases/permission.usecases';
import { AuditUseCases } from '@modules/iam/core/app/use-cases/audit.usecases';
import { CredentialUseCases } from '@modules/iam/core/app/use-cases/credential.usecases';

// --- adapters ---
const userRepo = new MongooseUserRepository();
const roleRepo = new MongooseRoleRepository();
const permissionRepo = new MongoosePermissionRepository();
const auditLogRepo = new MongooseAuditLogRepository();

const passwordHasher = new BcryptPasswordHasher();

// --- use-cases ---
export const credentialUseCases = new CredentialUseCases(passwordHasher);
export const auditUseCases = new AuditUseCases(auditLogRepo);
export const userUseCases = new UserUseCases(userRepo, passwordHasher, auditUseCases);
export const roleUseCases = new RoleUseCases(roleRepo, auditUseCases);
export const permissionUseCases = new PermissionUseCases(permissionRepo, auditUseCases);

// Identity-store repositories, exposed so a module that authenticates against
// IAM (Auth) can be composed against them without reaching into IAM internals.
export { userRepo, roleRepo, permissionRepo };
