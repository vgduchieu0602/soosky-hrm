import AuditController, { AuditControllerUseCases } from "@modules/iam/adapters/driver/http/controllers/AuditController";
import PermissionController, { PermissionControllerUseCases } from "@modules/iam/adapters/driver/http/controllers/PermissionController";
import RoleController, { RoleControllerUseCases } from "@modules/iam/adapters/driver/http/controllers/RoleController";
import UserController, { UserControllerUseCases } from "@modules/iam/adapters/driver/http/controllers/UserController";
import authenticate from "@shared/adapters/driver/http/middlewares/authenticate";
import errorHandler from "@shared/adapters/driver/http/middlewares/errorHandler";
import AccessTokenVerifier from "@shared/adapters/driver/http/ports/AccessTokenVerifier";
import { json, Router } from "express";

/**
 * Toàn bộ use-case mà driver adapter HTTP cần để phục vụ các endpoint của
 * module IAM (ánh xạ 1:1 với share-docs/use-cases.html § IAM).
 */
export type IamHttpUseCases =
    & UserControllerUseCases
    & RoleControllerUseCases
    & PermissionControllerUseCases
    & AuditControllerUseCases;

/**
 * Driver adapter HTTP của module IAM.
 *
 * Mọi endpoint yêu cầu Bearer token — không có endpoint public như Auth —
 * nên `authenticate` áp cho cả router thay vì gắn theo từng route.
 */
export function createIamHttpRouter(
    useCases: IamHttpUseCases,
    accessTokenVerifier: AccessTokenVerifier,
): Router {
    const users       = new UserController(useCases);
    const roles       = new RoleController(useCases);
    const permissions = new PermissionController(useCases);
    const audit       = new AuditController(useCases);

    const router = Router();

    router.use(json());
    router.use(authenticate(accessTokenVerifier));

    // User (share-docs/use-cases.html § IAM)
    router.get   ("/users",                        users.listUsers);
    router.get   ("/users/:userId",                 users.getUser);
    router.get   ("/users/:userId/permissions",     users.getUserPermissions);
    router.get   ("/users/:userId/roles",           users.listUserRoles);
    router.post  ("/users/:userId/roles",           users.assignRoleToUser);
    router.delete("/users/:userId/roles/:roleId",   users.revokeRoleFromUser);

    // Role
    router.get   ("/roles",                         roles.listRoles);
    router.post  ("/roles",                         roles.createRole);
    router.get   ("/roles/:roleId",                 roles.getRole);
    router.patch ("/roles/:roleId",                 roles.updateRole);
    router.delete("/roles/:roleId",                 roles.deleteRole);
    router.put   ("/roles/:roleId/permissions",     roles.setRolePermissions);

    // Permission (catalog)
    router.get   ("/permissions",                   permissions.listPermissions);

    // Audit
    router.get   ("/audit-logs",                    audit.listAuditLogs);

    router.use(errorHandler);

    return router;
}
