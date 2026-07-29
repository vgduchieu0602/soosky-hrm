import PermissionKeyInvalidError from "@modules/iam/core/domain/errors/PermissionKeyInvalidError";

const WILDCARD = "*";
const regexValidResourceAction = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/;

/**
 * Định danh quyền hạn: `resource:action` (vd: "employee:read") hoặc wildcard
 * "*" — sở hữu wildcard tương đương mọi quyền trong hệ thống.
 */
export default class PermissionKey {
    private constructor(
        public readonly value: string
    ) {}

    static create(raw: string): PermissionKey {
        const value = raw.trim().toLowerCase();

        if (value !== WILDCARD && !regexValidResourceAction.test(value)) {
            throw new PermissionKeyInvalidError("Permission key must be '*' or in the form 'resource:action'");
        }
        return new PermissionKey(value);
    }

    get isWildcard(): boolean {
        return this.value === WILDCARD;
    }

    get resource(): string {
        return this.isWildcard ? WILDCARD : this.value.split(":")[0] as string;
    }

    get action(): string {
        return this.isWildcard ? WILDCARD : this.value.split(":")[1] as string;
    }

    equals(other: PermissionKey): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
