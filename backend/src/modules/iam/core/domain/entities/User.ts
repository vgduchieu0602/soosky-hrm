import AggregateRoot from "@shared/core/domain/AggregateRoot";

export enum UserStatus {
    ACTIVE      = "active",
    DEACTIVATED = "deactivated",
}

export interface UserCreationInput {
    id:          string; // = accountId bên module Auth
    displayName: string;
    email:       string;
}

export interface UserProps {
    id:          string;
    displayName: string;
    email:       string;
    status:      UserStatus;
    createdAt:   Date;
}

/**
 * Bản chiếu (projection) của Account bên module Auth trong phạm vi module
 * IAM — chỉ giữ những gì RBAC cần để hiển thị/gán quyền, không sở hữu vòng
 * đời xác thực (đăng nhập, mật khẩu, ...).
 */
export default class User extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _displayName: string,
        private _email: string,
        private _status: UserStatus,
    ) {
        super();
    }

    get displayName(): string {
        return this._displayName;
    }
    get email(): string {
        return this._email;
    }
    get status(): UserStatus {
        return this._status;
    }
    get isActive(): boolean {
        return this._status === UserStatus.ACTIVE;
    }

    static create(input: UserCreationInput): User {
        return new User(input.id, new Date(), input.displayName, input.email, UserStatus.ACTIVE);
    }

    static rehydrate(props: UserProps): User {
        return new User(props.id, props.createdAt, props.displayName, props.email, props.status);
    }

    /**
     * Đồng bộ hồ sơ hiển thị (tên, email) theo bản chiếu Account mới nhất.
     *
     * Chỉ trả về true khi có thay đổi thực sự — caller chỉ lưu khi cần.
     */
    rename(displayName: string, email: string): boolean {
        const changed = this._displayName !== displayName || this._email !== email;
        if (!changed) return false;

        this._displayName = displayName;
        this._email       = email;
        return true;
    }

    deactivate(): void {
        this._status = UserStatus.DEACTIVATED;
    }

    reactivate(): void {
        this._status = UserStatus.ACTIVE;
    }
}
