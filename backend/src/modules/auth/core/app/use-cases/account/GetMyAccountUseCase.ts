import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import Account from "@modules/auth/core/domain/entities/Account";

export interface GetMyAccountInput {
    actorAccountId: string;
}

/**
 * Trả về account của chính actor đang đăng nhập — nguồn cho client biết
 * mình là ai (họ tên, email, role, trạng thái) mà không phải suy ra từ token.
 */
export default class GetMyAccountUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
    ) {}

    /**
     * @param input.actorAccountId Id account của actor (lấy từ access token).
     *
     * @returns Account của actor.
     *
     * @throws {AccountNotFoundError} Account không còn tồn tại (đã bị xoá sau khi token phát hành).
     */
    public async execute(input: GetMyAccountInput): Promise<Account> {
        const account = await this._accountRepo.getById(input.actorAccountId);
        if (account == undefined) {
            throw new AccountNotFoundError();
        }
        return account;
    }
}
