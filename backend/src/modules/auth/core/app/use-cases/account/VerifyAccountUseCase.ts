import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import { VerificationTokenInvalidError } from "@modules/auth/core/app/errors/VerificationTokenInvalidError";
import UnitOfWork from "@modules/auth/core/app/ports/UnitOfWork";
import Account from "@modules/auth/core/domain/entities/Account";
import { AccountVerifiedEvent } from "@modules/auth/core/domain/events/AccountVerifiedEvent";
import EventBus from "@shared/core/domain/EventBus";

export interface VerifyAccountInput {
    token: string;
}

/**
 * Xác minh email của account bằng token nhận qua mail lúc đăng ký: đổi token
 * lấy accountId, chuyển "pending" → "active" và phát sự kiện
 * `auth.account.verified` để các module khác tạo bản chiếu user.
 *
 * Đổi token và lưu account nằm trong một UnitOfWork: token dùng một lần nhưng
 * chỉ thực sự bị đốt khi bước xác minh thành công — lưu lỗi thì rollback, mở
 * lại link trong mail vẫn dùng được, không kẹt account ở "pending".
 *
 * Sự kiện phát sau khi commit; phát lỗi thì trạng thái đã lưu nhưng bản chiếu
 * user chưa được tạo — hạn chế đã biết, chờ hạ tầng outbox/retry.
 */
export default class VerifyAccountUseCase {
    public constructor(
        private readonly _uow: UnitOfWork,
        private readonly _eventBus: EventBus,
    ) {}

    /**
     * @param input.token Token xác minh trong mail gửi cho chủ tài khoản.
     *
     * @returns Account sau khi xác minh.
     *
     * @throws {VerificationTokenInvalidError} Token sai, hết hạn hoặc đã dùng.
     * @throws {AccountNotFoundError}          Account không tồn tại.
     * @throws {AccountDeactivatedError}       Account đã bị vô hiệu hoá.
     */
    public async execute(input: VerifyAccountInput): Promise<Account> {
        const { account, justVerified } = await this._uow.run(async ctx => {
            const accountId = await ctx.verificationTokenStore.consume(input.token);
            if (accountId == undefined) {
                throw new VerificationTokenInvalidError();
            }

            const account = await ctx.accountRepo.getById(accountId);
            if (account == undefined) {
                throw new AccountNotFoundError();
            }

            const justVerified = account.verify();
            if (justVerified) {
                await ctx.accountRepo.save(account);
            }
            return { account, justVerified };
        });

        if (!justVerified) return account;

        await this._eventBus.publish([new AccountVerifiedEvent(account)]);

        return account;
    }
}
