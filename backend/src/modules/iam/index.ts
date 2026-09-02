/**
 * Public surface of the IAM module — users, roles, permissions, audit trail.
 *
 * IAM answers "what is this user allowed to do?" and owns the identity store.
 * It depends on no other business module, so it can be reused as-is by another
 * product (Task Management, CRM, …) alongside HRM.
 */
export { default as iamRouter } from '@modules/iam/adapters/http/iam.routes';

// Use-cases, re-exported under the service names external callers already use.
export {
  userUseCases as userService,
  roleUseCases as roleService,
  permissionUseCases as permissionService,
  auditUseCases as auditService,
} from '@modules/iam/adapters/container';

// Identity-store repositories — the composition seam for a module that
// authenticates against IAM (see modules/auth/adapters/container.ts).
export {
  userRepo as userRepository,
  roleRepo as roleRepository,
  permissionRepo as permissionRepository,
} from '@modules/iam/adapters/container';

export type { CreateUserInput, UpdateUserInput } from '@modules/iam/core/app/use-cases/user.usecases';
export type { CreateRoleInput, UpdateRoleInput } from '@modules/iam/core/app/use-cases/role.usecases';
export type {
  CreatePermissionInput,
  UpdatePermissionInput,
} from '@modules/iam/core/app/use-cases/permission.usecases';
