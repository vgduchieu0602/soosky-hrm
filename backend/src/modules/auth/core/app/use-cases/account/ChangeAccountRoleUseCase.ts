import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import Account from "@modules/auth/core/domain/entities/Account";
import { AccountRoleChangedEvent } from "@modules/auth/core/domain/events/AccountRoleChangedEvent";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import EventBus from "@shared/core/domain/EventBus";

export interface ChangeAccountRoleInput {
    accountId:      string;
    actorAccountId: string;
    role:           string;
}

/**
 * Thay đổi role hệ thống của một account và phát sự kiện
 * `auth.account.role-changed` để các module khác cập nhật quyền hạn của bản
 * chiếu user tương ứng.
 *
 * Chỉ actor có role ADMIN trở lên được đổi role. Role SUPER_ADMIN nằm ngoài
 * phạm vi thao tác này: không thể trao và không thể gỡ (domain đảm nhiệm) —
 * hệ thống luôn giữ nguyên owner gốc.
 *
 * Idempotent: role không đổi thì bỏ qua, không phát lại sự kiện.
 */
export default class ChangeAccountRoleUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
        private readonly _eventBus: EventBus,
    ) {}

    /**
     * @param input.accountId      Id account cần đổi role.
     * @param input.actorAccountId Id account của actor — phải có role ADMIN trở lên.
     * @param input.role           Role mới: `admin` hoặc `member`.
     *
     * @returns Account sau khi đổi role.
     *
     * @throws {AccountRoleInvalidError}      `role` không hợp lệ.
     * @throws {AccessDeniedError}            Actor không tồn tại hoặc dưới role ADMIN.
     * @throws {AccountNotFoundError}         Account không tồn tại.
     * @throws {AccountDeactivatedError}      Account đã bị vô hiệu hoá.
     * @throws {SuperAdminRoleImmutableError} Gỡ role của SUPER_ADMIN hoặc trao role SUPER_ADMIN.
     */
    public async execute(input: ChangeAccountRoleInput): Promise<Account> {
        const newRole = AccountRole.fromValue(input.role);

        const actor = await this._accountRepo.getById(input.actorAccountId);
        if (actor == undefined || actor.role.isLowerThan(AccountRole.ADMIN)) {
            throw new AccessDeniedError();
        }

        const account = await this._accountRepo.getById(input.accountId);
        if (account == undefined) {
            throw new AccountNotFoundError();
        }

        const changed = account.changeRole(newRole);
        if (!changed) return account;

        await this._accountRepo.save(account);
        await this._eventBus.publish([new AccountRoleChangedEvent(account)]);

        return account;
    }
}
