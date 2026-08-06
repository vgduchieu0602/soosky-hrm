import AccessControl from "@modules/iam/core/app/services/AccessControl";
import { RoleNotFoundError } from "@modules/iam/core/app/errors/RoleNotFoundError";
import RolePermissionRepo from "@modules/iam/core/app/ports/RolePermissionRepo";
import RoleRepo from "@modules/iam/core/app/ports/RoleRepo";

const PERMISSION_IAM_MANAGE = "iam:manage";

export interface ListRolePermissionsOutput {
    permissionIds: string[];
}

/**
 * Quyền hạn đang gán cho một role.
 *
 * Có endpoint riêng vì `RoleDTO` cố tình KHÔNG nhúng danh sách quyền: danh sách
 * role được gọi ở mọi trang cấu hình, nhúng quyền vào đó là kéo theo một truy
 * vấn phụ cho mỗi role mà hầu hết chỗ dùng không cần. Màn hình sửa role gọi
 * thêm một lần cho đúng role nó đang mở.
 *
 * @throws {AccessDeniedError} Actor không có quyền `iam:manage`.
 * @throws {RoleNotFoundError} Role không tồn tại.
 */
export default class ListRolePermissionsUseCase {
    public constructor(
        private readonly _accessControl: AccessControl,
        private readonly _roleRepo: RoleRepo,
        private readonly _rolePermissionRepo: RolePermissionRepo,
    ) {}

    public async execute(input: { actorUserId: string; roleId: string }): Promise<ListRolePermissionsOutput> {
        await this._accessControl.assertPermission(input.actorUserId, PERMISSION_IAM_MANAGE);

        const role = await this._roleRepo.getById(input.roleId);
        if (role == undefined) throw new RoleNotFoundError();

        const rolePermissions = await this._rolePermissionRepo.listByRoleId(input.roleId);
        return { permissionIds: rolePermissions.map(rolePermission => rolePermission.permissionId) };
    }
}
