import RoleNameInvalidError from "@modules/iam/core/domain/errors/RoleNameInvalidError";

/**
 * Tên hiển thị của role — không bắt buộc duy nhất, chỉ ràng buộc không rỗng.
 */
export default class RoleName {
    private constructor(
        public readonly value: string
    ) {}

    static create(raw: string): RoleName {
        const value = raw.trim();

        if (!value.length) {
            throw new RoleNameInvalidError("Role name must not be empty");
        }
        return new RoleName(value);
    }

    equals(other: RoleName): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
