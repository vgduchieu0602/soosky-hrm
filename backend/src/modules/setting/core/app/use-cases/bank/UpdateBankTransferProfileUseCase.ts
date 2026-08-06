import BankTransferProfileNotFoundError from "@modules/setting/core/app/errors/BankTransferProfileNotFoundError";
import BankTransferProfileRepo from "@modules/setting/core/app/ports/BankTransferProfileRepo";
import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import BankTransferProfile, { BankTransferProfileUpdateInput } from "@modules/setting/core/domain/entities/BankTransferProfile";

const PERMISSION_KEY = "setting:manage";

export type UpdateBankTransferProfileInput = BankTransferProfileUpdateInput & {
    profileId:   string;
    actorUserId: string;
};

/**
 * Sửa mẫu file chuyển lương. `code` KHÔNG sửa được — nó là mã hồ sơ mà kế toán
 * dùng để gọi tên; đổi mã thì tạo hồ sơ mới.
 *
 * @throws {AccessDeniedError}                  Actor không có quyền `setting:manage`.
 * @throws {BankTransferProfileNotFoundError}   Không tìm thấy hồ sơ.
 * @throws {BankTransferProfileInvalidError}    Cột/định dạng không hợp lệ.
 */
export default class UpdateBankTransferProfileUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _profiles: BankTransferProfileRepo,
    ) {}

    public async execute(input: UpdateBankTransferProfileInput): Promise<BankTransferProfile> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const profile = await this._profiles.getById(input.profileId);
        if (profile == undefined) throw new BankTransferProfileNotFoundError();

        const { profileId: _profileId, actorUserId: _actorUserId, ...patch } = input;
        profile.update(patch);
        await this._profiles.save(profile);

        return profile;
    }
}
