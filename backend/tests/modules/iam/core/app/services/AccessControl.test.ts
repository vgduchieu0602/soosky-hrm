import AccessControl from "@modules/iam/core/app/services/AccessControl";
import Permission from "@modules/iam/core/domain/entities/Permission";
import RolePermission from "@modules/iam/core/domain/entities/RolePermission";
import UserRole from "@modules/iam/core/domain/entities/UserRole";
import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";
import PermissionRepo from "@modules/iam/core/app/ports/PermissionRepo";
import RolePermissionRepo from "@modules/iam/core/app/ports/RolePermissionRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { mock } from "vitest-mock-extended";
import { describe, expect, it } from "vitest";

describe("AccessControl", () => {
    const USER_ID       = "user-1";
    const ROLE_ID       = "role-1";
    const PERMISSION_ID = "permission-1";

    function makePermission(key: string): Permission {
        return Permission.rehydrate({
            id:          PERMISSION_ID,
            key:         PermissionKey.create(key),
            description: "",
            createdAt:   new Date(),
        });
    }

    it("allows when user's role holds the required permission", async () => {
        const userRoleRepo       = mock<UserRoleRepo>();
        const rolePermissionRepo = mock<RolePermissionRepo>();
        const permissionRepo     = mock<PermissionRepo>();

        userRoleRepo.listByUserId.mockResolvedValue([UserRole.rehydrate({ id: "ur-1", userId: USER_ID, roleId: ROLE_ID, assignedAt: new Date() })]);
        rolePermissionRepo.listByRoleIds.mockResolvedValue([RolePermission.rehydrate({ id: "rp-1", roleId: ROLE_ID, permissionId: PERMISSION_ID })]);
        permissionRepo.listByIds.mockResolvedValue([makePermission("employee:read")]);

        const accessControl = new AccessControl(userRoleRepo, rolePermissionRepo, permissionRepo);

        await expect(accessControl.assertPermission(USER_ID, "employee:read")).resolves.toBeUndefined();
    });

    it("denies when user has no role granting the required permission", async () => {
        const userRoleRepo       = mock<UserRoleRepo>();
        const rolePermissionRepo = mock<RolePermissionRepo>();
        const permissionRepo     = mock<PermissionRepo>();

        userRoleRepo.listByUserId.mockResolvedValue([]);

        const accessControl = new AccessControl(userRoleRepo, rolePermissionRepo, permissionRepo);

        await expect(accessControl.assertPermission(USER_ID, "employee:read")).rejects.toBeInstanceOf(AccessDeniedError);
    });

    it("allows any permission when user holds the wildcard '*'", async () => {
        const userRoleRepo       = mock<UserRoleRepo>();
        const rolePermissionRepo = mock<RolePermissionRepo>();
        const permissionRepo     = mock<PermissionRepo>();

        userRoleRepo.listByUserId.mockResolvedValue([UserRole.rehydrate({ id: "ur-1", userId: USER_ID, roleId: ROLE_ID, assignedAt: new Date() })]);
        rolePermissionRepo.listByRoleIds.mockResolvedValue([RolePermission.rehydrate({ id: "rp-1", roleId: ROLE_ID, permissionId: PERMISSION_ID })]);
        permissionRepo.listByIds.mockResolvedValue([makePermission("*")]);

        const accessControl = new AccessControl(userRoleRepo, rolePermissionRepo, permissionRepo);

        await expect(accessControl.assertPermission(USER_ID, "payroll:manage")).resolves.toBeUndefined();
    });
});
