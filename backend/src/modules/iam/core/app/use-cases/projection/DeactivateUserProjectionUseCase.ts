import UserRepo from "@modules/iam/core/app/ports/UserRepo";

export interface DeactivateUserProjectionInput {
    accountId: string;
}

/**
 * Vô hiệu hoá bản chiếu `User` khi nhận sự kiện `auth.account.deactivated`.
 *
 * Idempotent: user không tồn tại hoặc đã deactivated thì bỏ qua.
 */
export default class DeactivateUserProjectionUseCase {
    public constructor(
        private readonly _userRepo: UserRepo,
    ) {}

    public async execute(input: DeactivateUserProjectionInput): Promise<void> {
        const user = await this._userRepo.getById(input.accountId);
        if (user == undefined || !user.isActive) return;

        user.deactivate();
        await this._userRepo.save(user);
    }
}
