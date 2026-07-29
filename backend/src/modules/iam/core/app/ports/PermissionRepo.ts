import Permission from "@modules/iam/core/domain/entities/Permission";
import PermissionKey from "@modules/iam/core/domain/value-objects/PermissionKey";

export default interface PermissionRepo {
    getById(permissionId: string): Promise<Permission | null>;
    getByKey(key: PermissionKey): Promise<Permission | null>;
    existsByKey(key: PermissionKey): Promise<boolean>;

    /** Liệt kê nhiều permission theo id — dùng để giải quyết bộ quyền của một role. */
    listByIds(permissionIds: string[]): Promise<Permission[]>;

    /** Liệt kê toàn bộ catalog quyền hạn, theo thứ tự tạo (createdAt tăng dần). */
    list(): Promise<Permission[]>;

    save(permission: Permission): Promise<void>;
}
