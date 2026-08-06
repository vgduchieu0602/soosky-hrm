import { RoleIsSystemError } from "@modules/iam/core/app/errors/RoleIsSystemError";
import { RoleNotFoundError } from "@modules/iam/core/app/errors/RoleNotFoundError";
import { PermissionNotFoundError } from "@modules/iam/core/app/errors/PermissionNotFoundError";
import UnitOfWork from "@modules/iam/core/app/ports/UnitOfWork";
import AccessControl from "@modules/iam/core/app/services/AccessControl";
import AuditLog from "@modules/iam/core/domain/entities/AuditLog";
import RolePermission from "@modules/iam/core/domain/entities/RolePermission";
import createUuidV7 from "@shared/core/domain/UuidV7";

const PERMISSION_IAM_MANAGE       = "iam:manage";
const AUDIT_RESOURCE_ROLE         = "role";
const AUDIT_ACTION_SET_PERMISSIONS = "set-permissions";

export interface SetRolePermissionsInput {
    actorUserId:   string;
    roleId:        string;
    permissionIds: string[];
}

/**
 * Thay thế nguyên khối bộ quyền hạn của một role.
 *
 * Đọc role + permission, xoá bộ quyền hạn cũ và ghi bộ mới trong cùng một
 * `UnitOfWork` — không có trạng thái trung gian role rỗng quyền.
 */
export default class SetRolePermissionsUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _uow: UnitOfWork,
    ) {}

    /**
     * @param input.actorUserId   Id user thực hiện thao tác — phải giữ quyền `iam:manage`.
     * @param input.roleId        Id role cần đặt lại quyền hạn.
     * @param input.permissionIds Danh sách id quyền hạn — thay thế toàn bộ bộ quyền hạn hiện có.
     *
     * @throws {AccessDeniedError}      Actor không có quyền `iam:manage`.
     * @throws {RoleNotFoundError}      Role không tồn tại.
     * @throws {RoleIsSystemError}      Role là role hệ thống, không thể sửa quyền hạn.
     * @throws {PermissionNotFoundError} Một trong các permissionId không tồn tại.
     */
    public async execute(input: SetRolePermissionsInput): Promise<void> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        await this._uow.run(async ctx => {
            const role = await ctx.roleRepo.getById(input.roleId);
            if (role == undefined) {
                throw new RoleNotFoundError();
            }
            if (role.isSystem) {
                throw new RoleIsSystemError();
            }

            const uniqueIds  = [...new Set(input.permissionIds)];
            const permissions = await ctx.permissionRepo.listByIds(uniqueIds);
            if (permissions.length !== uniqueIds.length) {
                throw new PermissionNotFoundError();
            }

            const rolePermissions = uniqueIds.map(permissionId => RolePermission.create(createUuidV7(), role.id, permissionId));
            await ctx.rolePermissionRepo.replaceForRole(role.id, rolePermissions);

            await ctx.auditRepo.save(AuditLog.create({
                id:          createUuidV7(),
                actorUserId: input.actorUserId,
                resource:    AUDIT_RESOURCE_ROLE,
                action:      AUDIT_ACTION_SET_PERMISSIONS,
                resourceId:  role.id,
                changes:     { permissionIds: uniqueIds },
            }));
        });
    }
}
