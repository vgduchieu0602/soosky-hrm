import Role from "@modules/iam/core/domain/entities/Role";
import RoleKey from "@modules/iam/core/domain/value-objects/RoleKey";

export default interface RoleRepo {
    getById(roleId: string): Promise<Role | null>;
    getByKey(key: RoleKey): Promise<Role | null>;
    existsByKey(key: RoleKey): Promise<boolean>;

    /** Liệt kê toàn bộ role, theo thứ tự tạo (createdAt tăng dần). */
    list(): Promise<Role[]>;

    save(role: Role): Promise<void>;
    deleteById(roleId: string): Promise<void>;
}
