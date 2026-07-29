import Account, { AccountStatus } from "@modules/auth/core/domain/entities/Account";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import Email from "@shared/core/domain/value-objects/email/Email";

export interface AccountListFilter {
    status?: AccountStatus;
}

export default interface AccountRepo {
    getById(accountId: string): Promise<Account | null>;
    getByEmail(email: Email): Promise<Account | null>;
    existsByEmail(email: Email): Promise<boolean>;
    existsByRole(role: AccountRole): Promise<boolean>;

    /** Liệt kê account khớp bộ lọc, theo thứ tự đăng ký (createdAt tăng dần). */
    list(filter: AccountListFilter): Promise<Account[]>;

    save(account: Account): Promise<void>;

    /**
     * Xoá hẳn account khỏi kho lưu trữ. Account không tồn tại thì bỏ qua
     * (idempotent) — caller tự kiểm tra tồn tại/trạng thái trước khi xoá.
     */
    deleteById(accountId: string): Promise<void>;
}
