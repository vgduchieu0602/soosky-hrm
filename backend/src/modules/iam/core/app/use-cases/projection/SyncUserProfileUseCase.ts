import UserRepo from "@modules/iam/core/app/ports/UserRepo";

export interface SyncUserProfileInput {
    accountId:   string;
    displayName: string;
    email:       string;
}

/**
 * Đồng bộ hồ sơ hiển thị của bản chiếu `User` khi nhận sự kiện
 * `auth.account.profile-updated`.
 *
 * Idempotent: user chưa tồn tại (chưa từng được xác minh) thì bỏ qua —
 * chờ sự kiện `auth.account.verified` tạo bản chiếu trước.
 */
export default class SyncUserProfileUseCase {
    public constructor(
        private readonly _userRepo: UserRepo,
    ) {}

    public async execute(input: SyncUserProfileInput): Promise<void> {
        const user = await this._userRepo.getById(input.accountId);
        if (user == undefined) return;

        const changed = user.rename(input.displayName, input.email);
        if (!changed) return;

        await this._userRepo.save(user);
    }
}
