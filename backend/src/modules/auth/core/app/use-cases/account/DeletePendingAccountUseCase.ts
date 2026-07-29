import { AccountNotDeletableError } from "@modules/auth/core/app/errors/AccountNotDeletableError";
import { AccountNotFoundError } from "@modules/auth/core/app/errors/AccountNotFoundError";
import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import VerificationTokenStore from "@modules/auth/core/app/ports/VerificationTokenStore";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

export interface DeletePendingAccountInput {
    accountId:      string;
    actorAccountId: string;
}

/**
 * Xoá hẳn một account còn ở trạng thái "pending" (đăng ký nhưng chưa xác minh
 * email) — dọn account rác hoặc giải phóng email bị giữ bởi lượt đăng ký
 * nhầm, vì unique index trên email chặn đăng ký lại chừng nào account pending
 * còn đó.
 *
 * Chỉ ADMIN trở lên được xoá; account pending chưa từng đăng nhập được nên
 * không có chuyện chính chủ tự thao tác. Chỉ account "pending" xoá được —
 * account đã kích hoạt có bản chiếu và dữ liệu ở module khác, muốn khoá thì
 * dùng DeactivateAccount.
 *
 * Không phát sự kiện tích hợp: bản chiếu user ở module khác chỉ được tạo khi
 * account được xác minh, nên account pending không để lại dấu vết bên ngoài
 * Auth. Token xác minh còn treo được thu hồi cùng lúc; refresh token không
 * thể tồn tại vì account pending chưa từng đăng nhập.
 */
export default class DeletePendingAccountUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
        private readonly _verificationTokenStore: VerificationTokenStore,
    ) {}

    /**
     * @param input.accountId      Id account pending cần xoá.
     * @param input.actorAccountId Id account của actor — phải có role ADMIN trở lên.
     *
     * @throws {AccessDeniedError}        Actor không tồn tại hoặc dưới role ADMIN.
     * @throws {AccountNotFoundError}     Account không tồn tại.
     * @throws {AccountNotDeletableError} Account không ở trạng thái "pending".
     */
    public async execute(input: DeletePendingAccountInput): Promise<void> {
        const actor = await this._accountRepo.getById(input.actorAccountId);
        if (actor == undefined || actor.role.isLowerThan(AccountRole.ADMIN)) {
            throw new AccessDeniedError();
        }

        const account = await this._accountRepo.getById(input.accountId);
        if (account == undefined) {
            throw new AccountNotFoundError();
        }
        if (!account.isPending) {
            throw new AccountNotDeletableError();
        }

        await this._verificationTokenStore.revokeAllForAccount(account.id);
        await this._accountRepo.deleteById(account.id);
    }
}
