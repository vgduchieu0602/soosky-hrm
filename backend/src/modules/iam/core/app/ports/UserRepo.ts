import User from "@modules/iam/core/domain/entities/User";

export default interface UserRepo {
    getById(userId: string): Promise<User | null>;
    existsById(userId: string): Promise<boolean>;

    /** Liệt kê toàn bộ user, theo thứ tự tạo (createdAt tăng dần). */
    list(): Promise<User[]>;

    save(user: User): Promise<void>;
}
