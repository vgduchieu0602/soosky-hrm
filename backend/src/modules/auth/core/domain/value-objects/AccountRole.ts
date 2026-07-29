import AccountRoleInvalidError from "@modules/auth/core/domain/errors/AccountRoleInvalidError";

export default class AccountRole {
    static readonly SUPER_ADMIN  = new AccountRole("owner",  10);
    static readonly ADMIN        = new AccountRole("admin",  9);
    static readonly MEMBER       = new AccountRole("member", 1);

    private constructor(
        readonly value: string,
        readonly rank:  number,
    ) {}

    isLowerThan(other: AccountRole): boolean {
        return this.rank < other.rank;
    }

    equals(other: AccountRole): boolean {
        return this.value === other.value;
    }

    static fromValue(value: string): AccountRole {
        switch (value) {
            case AccountRole.SUPER_ADMIN.value:  return AccountRole.SUPER_ADMIN;
            case AccountRole.ADMIN.value:        return AccountRole.ADMIN;
            case AccountRole.MEMBER.value:       return AccountRole.MEMBER;
            default: throw new AccountRoleInvalidError(value);
        }
    }
}
