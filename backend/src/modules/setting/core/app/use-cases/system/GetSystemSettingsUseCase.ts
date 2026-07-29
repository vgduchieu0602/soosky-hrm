import SystemSettingRepo from "@modules/setting/core/app/ports/SystemSettingRepo";
import { SettingValue } from "@modules/setting/core/domain/entities/SystemSetting";

/**
 * Lấy toàn bộ cấu hình hệ thống dạng key-value. Mở cho mọi user đã xác
 * thực; trả về object rỗng khi chưa từng thiết lập gì (không ném lỗi —
 * không có cấu hình cũng là một trạng thái hợp lệ).
 */
export default class GetSystemSettingsUseCase {
    public constructor(
        private readonly _systemSettingRepo: SystemSettingRepo,
    ) {}

    public async execute(): Promise<Record<string, SettingValue>> {
        const setting = await this._systemSettingRepo.get();
        return setting?.entries ?? {};
    }
}
