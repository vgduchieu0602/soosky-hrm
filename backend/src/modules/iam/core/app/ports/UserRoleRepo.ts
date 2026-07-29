import UserRole from "@modules/iam/core/domain/entities/UserRole";

export default interface UserRoleRepo {
    getByUserAndRole(userId: string, roleId: string): Promise<UserRole | null>;

    /** Liệt kê các lượt gán role của một user. */
    listByUserId(userId: string): Promise<UserRole[]>;

    /** Liệt kê các lượt gán role của toàn bộ user đang giữ một role — dùng để kiểm tra role còn được gán hay không. */
    listByRoleId(roleId: string): Promise<UserRole[]>;

    existsByRoleId(roleId: string): Promise<boolean>;

    save(userRole: UserRole): Promise<void>;
    deleteById(userRoleId: string): Promise<void>;
}
