import RolePermission from "@modules/iam/core/domain/entities/RolePermission";

export default interface RolePermissionRepo {
    /** Liệt kê các quyền hạn thuộc về một role. */
    listByRoleId(roleId: string): Promise<RolePermission[]>;

    /** Liệt kê các quyền hạn thuộc về nhiều role — dùng để giải quyết quyền hạn hiệu lực của user. */
    listByRoleIds(roleIds: string[]): Promise<RolePermission[]>;

    save(rolePermission: RolePermission): Promise<void>;

    /** Thay thế toàn bộ bộ quyền hạn hiện có của một role bằng danh sách mới. */
    replaceForRole(roleId: string, rolePermissions: RolePermission[]): Promise<void>;

    deleteByRoleId(roleId: string): Promise<void>;
}
