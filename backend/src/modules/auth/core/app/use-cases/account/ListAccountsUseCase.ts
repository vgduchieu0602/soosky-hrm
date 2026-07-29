import AccountRepo from "@modules/auth/core/app/ports/AccountRepo";
import Account, { AccountStatus } from "@modules/auth/core/domain/entities/Account";
import AccountRole from "@modules/auth/core/domain/value-objects/AccountRole";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";

export interface ListAccountsInput {
    actorAccountId: string;

    /** Lọc theo trạng thái account; vắng mặt → trả tất cả. */
    status?: AccountStatus;
}

/**
 * Liệt kê account trong hệ thống, tuỳ chọn lọc theo trạng thái.
 *
 * Chỉ actor có role ADMIN trở lên được phép — danh sách lộ email/role/trạng
 * thái của mọi account nên không mở cho thành viên thường.
 */
export default class ListAccountsUseCase {
    public constructor(
        private readonly _accountRepo: AccountRepo,
    ) {}

    /**
     * @param input.actorAccountId Id account của actor — phải có role ADMIN trở lên.
     * @param input.status         Trạng thái muốn lọc (tuỳ chọn).
     *
     * @returns Danh sách account khớp bộ lọc, theo thứ tự đăng ký.
     *
     * @throws {AccessDeniedError} Actor không tồn tại hoặc dưới role ADMIN.
     */
    public async execute(input: ListAccountsInput): Promise<Account[]> {
        const actor = await this._accountRepo.getById(input.actorAccountId);
        if (actor == undefined || actor.role.isLowerThan(AccountRole.ADMIN)) {
            throw new AccessDeniedError();
        }

        return this._accountRepo.list(input.status ? { status: input.status } : {});
    }
}
