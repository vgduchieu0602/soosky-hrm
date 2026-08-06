import PermissionKeyInvalidError from "@modules/iam/core/domain/errors/PermissionKeyInvalidError";

const WILDCARD = "*";

/**
 * `resource:action` kèm hậu tố phạm vi TUỲ CHỌN `:team` hoặc `:self`.
 * Chỉ hai hậu tố này được phép — phạm vi là tập đóng, không cho tự đặt thêm,
 * để `resolvePermissionScope` không bao giờ gặp giá trị nó không hiểu.
 */
const regexValidResourceAction = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*(:(team|self))?$/;

/**
 * Định danh quyền hạn: `resource:action` (vd "employee:read"),
 * `resource:action:team` / `resource:action:self` (bản thu hẹp phạm vi), hoặc
 * wildcard "*" — sở hữu wildcard tương đương mọi quyền trong hệ thống.
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

    /** Hậu tố phạm vi nếu có (`team`/`self`); `undefined` = phạm vi toàn bộ. */
    get scopeSuffix(): "team" | "self" | undefined {
        const suffix = this.value.split(":")[2];
        return suffix === "team" || suffix === "self" ? suffix : undefined;
    }

    equals(other: PermissionKey): boolean {
        return this.value === other.value;
    }

    toString(): string {
        return this.value;
    }
}
