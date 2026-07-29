import AuditRepo from "@modules/iam/core/app/ports/AuditRepo";
import PermissionRepo from "@modules/iam/core/app/ports/PermissionRepo";
import RolePermissionRepo from "@modules/iam/core/app/ports/RolePermissionRepo";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";
import UserRepo from "@modules/iam/core/app/ports/UserRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import { UnitOfWork as BaseUnitOfWork } from "@shared/ports/UnitOfWork";

/**
 * Bộ cổng driven mà use-case IAM được cấp bên trong một `UnitOfWork.run` —
 * mọi thao tác ghi qua các cổng này là nguyên tử với nhau.
 */
export interface IamUoWContext {
    userRepo:           UserRepo;
    roleRepo:            RoleRepo;
    permissionRepo:      PermissionRepo;
    userRoleRepo:        UserRoleRepo;
    rolePermissionRepo:  RolePermissionRepo;
    auditRepo:           AuditRepo;
}

export default interface UnitOfWork extends BaseUnitOfWork<IamUoWContext> {}
