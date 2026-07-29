import RoleKeyInvalidError from "@modules/iam/core/domain/errors/RoleKeyInvalidError";

const regexValidRoleKey = /^[a-z][a-z0-9_-]*$/;

/**
 * Định danh kỹ thuật, bất biến của một role (vd: "admin", "hr-manager").
 * Duy nhất trong toàn hệ thống, chỉ chấp nhận chữ thường/số/`-`/`_`.
 */
export default class RoleKey {
    private constructor(
        public readonly value: string
    ) {}

    static create(raw: string): RoleKey {
        const value = raw.trim().toLowerCase();

        if (!value.length || !regexValidRoleKey.test(value)) {
            throw new RoleKeyInvalidError("Role key must be non-empty lowercase (letters, digits, '-', '_')");
        }
        return new RoleKey(value);
    }

    equals(other: RoleKey): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
