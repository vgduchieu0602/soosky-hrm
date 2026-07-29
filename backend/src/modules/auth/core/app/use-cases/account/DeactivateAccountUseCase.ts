import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import RefreshTokenStore from "@modules/auth/core/app/ports/RefreshTokenStore";
import Account from "@modules/auth/core/domain/entities/Account";
import { AccountDeactivatedEvent } from "@modules/auth/core/domain/events/AccountDeactivatedEvent";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import EventBus from "@shared/core/domain/EventBus";

export interface DeactivateAccountInput {
    accountId:      string;
    actorAccountId: string;
}

/**
 * Vô hiệu hoá account: chặn đăng nhập, thu hồi toàn bộ refresh token và phát
 * sự kiện `auth.account.deactivated` để các module khác vô hiệu hoá bản chiếu
 * user tương ứng.
 *
 * Chỉ chính chủ được tự vô hiệu hoá account của mình; khi hệ thống có vai trò
 * admin thì nới thêm cho admin (docs/api.html: "Chính chủ hoặc admin").
 *
 * Idempotent: account đã vô hiệu hoá rồi thì bỏ qua, không phát lại sự kiện.
 */
export default class DeactivateAccountUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
        private readonly _eventBus: EventBus,
        private readonly _refreshTokenStore: RefreshTokenStore,
    ) {}

    /**
     * @param input.accountId      Id account cần vô hiệu hoá.
     * @param input.actorAccountId Id account của actor — phải là chính chủ.
     *
     * @returns Account sau khi vô hiệu hoá.
     *
     * @throws {AccessDeniedError}    Actor không phải chính chủ.
     * @throws {AccountNotFoundError} Account không tồn tại.
     */
    public async execute(input: DeactivateAccountInput): Promise<Account> {
        if (input.actorAccountId !== input.accountId) {
            throw new AccessDeniedError();
        }

        const account = await this._accountRepo.getById(input.accountId);
        if (account == undefined) {
            throw new AccountNotFoundError();
        }
        if (account.isDeactivated) return account;

        account.deactivate();
        await this._accountRepo.save(account);

        await this._refreshTokenStore.revokeAllForAccount(account.id);
        await this._eventBus.publish([new AccountDeactivatedEvent(account.id)]);

        return account;
    }
}
