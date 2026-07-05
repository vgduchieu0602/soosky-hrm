// Public surface of the IAM feature (Clean Architecture).
export { default as iamRouter } from '@features/iam/interfaces/http/iam.routes';

// Use-cases re-exported under their legacy service names for external callers.
export {
  authUseCases as authService,
  userUseCases as userService,
  roleUseCases as roleService,
  permissionUseCases as permissionService,
  tokenService,
} from '@features/iam/container';

export type { AuthenticatedUser, LoginResult } from '@features/iam/application/auth.usecases';
export type { CreateUserInput, UpdateUserInput } from '@features/iam/application/user.usecases';
export type { CreateRoleInput, UpdateRoleInput } from '@features/iam/application/role.usecases';
export type { CreatePermissionInput, UpdatePermissionInput } from '@features/iam/application/permission.usecases';
