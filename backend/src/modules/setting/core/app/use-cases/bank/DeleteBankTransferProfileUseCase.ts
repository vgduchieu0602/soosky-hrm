import BankTransferProfileNotFoundError from "@modules/setting/core/app/errors/BankTransferProfileNotFoundError";
import BankTransferProfileRepo from "@modules/setting/core/app/ports/BankTransferProfileRepo";
import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import BankTransferProfileInvalidError from "@modules/setting/core/domain/errors/BankTransferProfileInvalidError";

const PERMISSION_KEY = "setting:manage";

/**
 * Xoá mẫu file chuyển lương. Hồ sơ ĐANG BẬT không xoá được — xoá nó là làm luồng
 * xuất file chết mà không ai báo trước; phải bật hồ sơ khác rồi mới xoá.
 *
 * @throws {AccessDeniedError}                  Actor không có quyền `setting:manage`.
 * @throws {BankTransferProfileNotFoundError}   Không tìm thấy hồ sơ.
 * @throws {BankTransferProfileInvalidError}    Hồ sơ đang bật.
 */
export default class DeleteBankTransferProfileUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _profiles: BankTransferProfileRepo,
    ) {}

    public async execute(input: { profileId: string; actorUserId: string }): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const profile = await this._profiles.getById(input.profileId);
        if (profile == undefined) throw new BankTransferProfileNotFoundError();
        if (profile.isActive) {
            throw new BankTransferProfileInvalidError("Cannot delete the active profile; activate another one first");
        }

        await this._profiles.deleteById(input.profileId);
    }
}
