import UserRepo from "@modules/iam/core/app/ports/UserRepo";

export interface ReactivateUserProjectionInput {
    accountId: string;
}

/**
 * Khôi phục bản chiếu `User` khi nhận sự kiện `auth.account.reactivated`.
 *
 * Idempotent: user không tồn tại hoặc đã active thì bỏ qua.
 */
export default class ReactivateUserProjectionUseCase {
    public constructor(
        private readonly _userRepo: UserRepo,
    ) {}

    public async execute(input: ReactivateUserProjectionInput): Promise<void> {
        const user = await this._userRepo.getById(input.accountId);
        if (user == undefined || user.isActive) return;

        user.reactivate();
        await this._userRepo.save(user);
    }
}
