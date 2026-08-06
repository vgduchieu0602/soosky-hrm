import PermissionRepo from "@modules/iam/core/app/ports/PermissionRepo";
import RolePermissionRepo from "@modules/iam/core/app/ports/RolePermissionRepo";
import UserRoleRepo from "@modules/iam/core/app/ports/UserRoleRepo";
import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";
import { PermissionScope, resolvePermissionScope, WILDCARD_PERMISSION_KEY } from "@shared/core/app/authorization/PermissionScope";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

/**
 * Dịch vụ trung tâm giải quyết quyền hạn hiệu lực của một user: role của
 * user → quyền hạn của các role đó → hợp thành tập quyền hạn hiệu lực.
 *
 * Mọi use-case mutating của module IAM gọi `assertPermission` trước khi thao
 * tác — không phân biệt actor là ai, chỉ dựa trên quyền hạn được gán.
 */
export default class AccessControl {
    public constructor(
        private readonly _userRoleRepo: UserRoleRepo,
        private readonly _rolePermissionRepo: RolePermissionRepo,
        private readonly _permissionRepo: PermissionRepo,
    ) {}

    /**
     * @param actorUserId    Id user thực hiện thao tác.
     * @param permissionKey  Quyền hạn cần có (vd: "iam:manage").
     *
     * @throws {AccessDeniedError} User không giữ quyền hạn này và cũng không giữ wildcard "*".
     */
    public async assertPermission(actorUserId: string, permissionKey: string): Promise<void> {
        const key         = PermissionKey.create(permissionKey);
        const effective    = await this.listPermissionsOf(actorUserId);
        const hasPermission = effective.includes(key.value) || effective.includes(WILDCARD_PERMISSION_KEY);

        if (!hasPermission) {
            throw new AccessDeniedError();
        }
    }

    /**
     * Phân giải PHẠM VI dữ liệu mà actor được phép chạm tới trên một khoá gốc
     * (vd `employee:read` → `all` cho HR, `team` cho Manager, `self` cho
     * Employee). Quy ước hậu tố `:team`/`:self` xem
     * {@link resolvePermissionScope}.
     *
     * Dùng cho các use-case ĐỌC nhiều bản ghi: không chỉ trả lời "được hay
     * không" mà còn "được tới đâu", để use-case tự thu hẹp dữ liệu trả về.
     *
     * @throws {AccessDeniedError} Actor không giữ quyền nào trên khoá này.
     */
    public async resolveScope(actorUserId: string, baseKey: string): Promise<PermissionScope> {
        // Vẫn qua PermissionKey để chuẩn hoá + validate như assertPermission.
        const key   = PermissionKey.create(baseKey);
        const scope = resolvePermissionScope(await this.listPermissionsOf(actorUserId), key.value);

        if (scope == undefined) throw new AccessDeniedError();
        return scope;
    }

    /**
     * Liệt kê toàn bộ khoá quyền hạn hiệu lực của một user (hợp của quyền hạn
     * mọi role đang được gán cho user đó).
     */
    public async listPermissionsOf(userId: string): Promise<string[]> {
        const userRoles = await this._userRoleRepo.listByUserId(userId);
        if (userRoles.length === 0) return [];

        const roleIds         = userRoles.map(userRole => userRole.roleId);
        const rolePermissions = await this._rolePermissionRepo.listByRoleIds(roleIds);
        if (rolePermissions.length === 0) return [];

        const permissionIds = [...new Set(rolePermissions.map(rolePermission => rolePermission.permissionId))];
        const permissions   = await this._permissionRepo.listByIds(permissionIds);

        return [...new Set(permissions.map(permission => permission.key.value))];
    }
}
