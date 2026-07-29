import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import Account from "@modules/auth/core/domain/entities/Account";
import { AccountReactivatedEvent } from "@modules/auth/core/domain/events/AccountReactivatedEvent";
import EventBus from "@shared/core/domain/EventBus";

export interface ReactivateAccountInput {
    accountId: string;
}

/**
 * Khôi phục account đã vô hiệu hoá và phát sự kiện `auth.account.reactivated`
 * để các module khác khôi phục bản chiếu user tương ứng.
 *
 * Trạng thái sau khôi phục do domain quyết định: về "active" nếu email đã
 * từng được xác minh, ngược lại về "pending".
 *
 * Theo docs/api.html thao tác này dành cho admin/support; hệ thống chưa có
 * vai trò nên tạm chưa kiểm tra actor — bổ sung khi có role system.
 */
export default class ReactivateAccountUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
        private readonly _eventBus: EventBus,
    ) {}

    /**
     * @param input.accountId Id account cần khôi phục.
     *
     * @returns Account sau khi khôi phục.
     *
     * @throws {AccountNotFoundError}                 Account không tồn tại.
     * @throws {AccountStatusInvalidTransitionError}  Account không ở trạng thái deactivated.
     */
    public async execute(input: ReactivateAccountInput): Promise<Account> {
        const account = await this._accountRepo.getById(input.accountId);
        if (account == undefined) {
            throw new AccountNotFoundError();
        }

        account.reactivate();
        await this._accountRepo.save(account);

        await this._eventBus.publish([new AccountReactivatedEvent(account.id)]);

        return account;
    }
}
