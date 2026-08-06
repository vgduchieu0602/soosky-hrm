import BankTransferProfileNotFoundError from "@modules/setting/core/app/errors/BankTransferProfileNotFoundError";
import BankTransferProfileRepo from "@modules/setting/core/app/ports/BankTransferProfileRepo";
import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import BankTransferProfile from "@modules/setting/core/domain/entities/BankTransferProfile";

const PERMISSION_KEY = "setting:manage";

/**
 * Bật một hồ sơ ngân hàng và tắt hồ sơ đang bật.
 *
 * Đúng một hồ sơ active tại một thời điểm: file chuyển lương không được mơ hồ về
 * việc nộp cho ngân hàng nào.
 *
 * @throws {AccessDeniedError}                  Actor không có quyền `setting:manage`.
 * @throws {BankTransferProfileNotFoundError}   Không tìm thấy hồ sơ.
 */
export default class ActivateBankTransferProfileUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _profiles: BankTransferProfileRepo,
    ) {}

    public async execute(input: { profileId: string; actorUserId: string }): Promise<BankTransferProfile> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const profile = await this._profiles.getById(input.profileId);
        if (profile == undefined) throw new BankTransferProfileNotFoundError();

        const current = await this._profiles.findActive();
        if (current != undefined && current.id !== profile.id) {
            current.deactivate();
            await this._profiles.save(current);
        }

        profile.activate();
        await this._profiles.save(profile);

        return profile;
    }
}
