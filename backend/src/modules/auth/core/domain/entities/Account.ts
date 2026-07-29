import AccountDeactivatedError from "@modules/auth/core/domain/errors/AccountDeactivatedError";
import AccountNotVerifiedError from "@modules/auth/core/domain/errors/AccountNotVerifiedError";
import AccountStatusInvalidTransitionError from "@modules/auth/core/domain/errors/AccountStatusInvalidTransitionError";
import SuperAdminRoleImmutableError from "@modules/auth/core/domain/errors/SuperAdminRoleImmutableError";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import FullName from "@modules/auth/core/domain/value-objects/FullName";
import AggregateRoot from "@shared/core/domain/AggregateRoot";
import Email from "@shared/core/domain/value-objects/email/Email";

export interface AccountRegistrationInput {
    id:           string;
    email:        Email;
    passwordHash: string;
    fullName:     FullName;
    role:         AccountRole;
}

export interface AccountProfileUpdateInput {
    email:    Email;
    fullName: FullName;
}

export interface AccountProps {
    id:           string;
    email:        Email;
    passwordHash: string; // đã được băm ở tầng hạ tầng; domain chỉ giữ giá trị
    fullName:     FullName;
    role:         AccountRole;
    status:       AccountStatus;
    verifiedAt:   Date | null;
    createdAt:    Date;
}

export enum AccountStatus {
    PENDING     = "pending",
    ACTIVE      = "active",
    DEACTIVATED = "deactivated",
}

export default class Account extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _email: Email,
        private _fullName: FullName,
        private _passwordHash: string,
        private _role: AccountRole,
        private _status: AccountStatus,
        private _verifiedAt: Date | null,
    ) {
        super();
    }

    get email(): Email {
        return this._email;
    }
    get fullName(): FullName {
        return this._fullName;
    }
    get passwordHash(): string {
        return this._passwordHash;
    }
    get role(): AccountRole {
        return this._role;
    }
    get status(): AccountStatus {
        return this._status;
    }
    get verifiedAt(): Date | null {
        return this._verifiedAt;
    }

    get isPending(): boolean {
        return this._status === AccountStatus.PENDING;
    }
    get isActive(): boolean {
        return this._status === AccountStatus.ACTIVE;
    }
    get isDeactivated(): boolean {
        return this._status === AccountStatus.DEACTIVATED;
    }
    get isVerified(): boolean {
        return this._verifiedAt !== null;
    }

    static register(input: AccountRegistrationInput): Account {
        return new Account(
            input.id,
            new Date(),
            input.email,
            input.fullName,
            input.passwordHash,
            input.role,
            AccountStatus.PENDING,
            null,
        );
    }

    static rehydrate(props: AccountProps): Account {
        return new Account(
            props.id,
            props.createdAt,
            props.email,
            props.fullName,
            props.passwordHash,
            props.role,
            props.status,
            props.verifiedAt,
        );
    }

    changePassword(newHash: string): void {
        if (this.isDeactivated) {
            throw new AccountDeactivatedError();
        }
        this._passwordHash = newHash;
    }

    /**
     * Cập nhật hồ sơ (email, họ tên).
     *
     * Đổi email không yêu cầu xác minh lại: `verifiedAt` và trạng thái giữ
     * nguyên — xác minh gắn với account, không gắn với địa chỉ email cụ thể.
     *
     * Chỉ trả về true khi có thay đổi thực sự — caller chỉ lưu và phát event
     * `auth.account.profile-updated` trong trường hợp đó.
     */
    updateProfile(input: AccountProfileUpdateInput): boolean {
        if (this.isDeactivated) {
            throw new AccountDeactivatedError();
        }

        const changed = !this._email.equals(input.email)
            || !this._fullName.equals(input.fullName)
            ;
        if (!changed) return false;

        this._email    = input.email;
        this._fullName = input.fullName;
        return true;
    }

    /**
     * Thay đổi role của account.
     *
     * SUPER_ADMIN là role gốc duy nhất của hệ thống: không thể bị gỡ khỏi
     * account đang giữ và cũng không thể trao cho account khác qua thao tác
     * đổi role.
     *
     * Chỉ trả về true khi có thay đổi thực sự — caller chỉ lưu và phát event
     * `auth.account.role-changed` trong trường hợp đó.
     *
     * @throws {AccountDeactivatedError}      Account đã bị vô hiệu hoá.
     * @throws {SuperAdminRoleImmutableError} Gỡ role của SUPER_ADMIN hoặc trao role SUPER_ADMIN.
     */
    changeRole(newRole: AccountRole): boolean {
        if (this.isDeactivated) {
            throw new AccountDeactivatedError();
        }
        if (this._role.equals(newRole)) {
            return false;
        }
        if (this._role.equals(AccountRole.SUPER_ADMIN) || newRole.equals(AccountRole.SUPER_ADMIN)) {
            throw new SuperAdminRoleImmutableError();
        }

        this._role = newRole;
        return true;
    }

    /**
     * Xác minh email: được phép bất cứ lúc nào miễn account
     * không ở trạng thái deactivated, và chưa được xác minh.
     *
     * Chỉ lần gọi đầu tiên ghi `verifiedAt` và trả về true — caller chỉ phát
     * event `auth.account.verified` trong trường hợp đó.
     */
    verify(): boolean {
        if (this.isDeactivated) {
            throw new AccountDeactivatedError();
        }
        if (this.isVerified) {
            return false;
        }

        this._verifiedAt = new Date();
        this._status     = AccountStatus.ACTIVE;
        return true;
    }

    deactivate(): void {
        this._status = AccountStatus.DEACTIVATED;
    }

    /**
     * Khôi phục account đã vô hiệu hoá: về "active" nếu email đã từng được xác minh, ngược lại về "pending".
     */
    reactivate(): void {
        const target = this.isVerified ?
            AccountStatus.ACTIVE :
            AccountStatus.PENDING
            ;

        if (this.isDeactivated == false) {
            throw new AccountStatusInvalidTransitionError(this._status, target);
        }
        this._status = target;
    }

    ensureCanLogin(): void {
        switch (true) {
            case this.isPending:
                throw new AccountNotVerifiedError();
            case this.isDeactivated:
                throw new AccountDeactivatedError();
        }
    }
}
