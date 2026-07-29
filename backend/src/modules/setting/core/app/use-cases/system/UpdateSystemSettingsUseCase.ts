import PermissionChecker from "@modules/setting/core/app/ports/PermissionChecker";
import SystemSettingRepo from "@modules/setting/core/app/ports/SystemSettingRepo";
import SystemSetting from "@modules/setting/core/domain/entities/SystemSetting";

const PERMISSION_KEY = "setting:manage";

export interface UpdateSystemSettingsInput {
    entries:     Record<string, unknown>;
    actorUserId: string;
}

/**
 * Trộn (merge-patch) các cặp key/value mới vào cấu hình hệ thống (singleton
 * duy nhất) — tạo mới nếu chưa từng thiết lập. Key/value không hợp lệ ném
 * lỗi domain trước khi có bất kỳ thay đổi nào được lưu.
 *
 * @throws {AccessDeniedError}        Actor không có quyền `setting:manage`.
 * @throws {SystemSettingInvalidError} Key/value không hợp lệ.
 */
export default class UpdateSystemSettingsUseCase {
    public constructor(
        private readonly _permissions:       PermissionChecker,
        private readonly _systemSettingRepo: SystemSettingRepo,
    ) {}

    public async execute(input: UpdateSystemSettingsInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const setting = (await this._systemSettingRepo.get()) ?? SystemSetting.create();
        setting.merge(input.entries);

        await this._systemSettingRepo.save(setting);
    }
}
