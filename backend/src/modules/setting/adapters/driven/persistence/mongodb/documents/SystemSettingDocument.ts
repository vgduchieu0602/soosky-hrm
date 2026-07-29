import { SettingValue } from "@modules/setting/core/domain/entities/SystemSetting";

/** Dạng document lưu trữ của aggregate `SystemSetting` (singleton, `_id` cố định). */
export default interface SystemSettingDocument {
    _id:       string;
    entries:   Record<string, SettingValue>;
    createdAt: Date;
    updatedAt: Date;
}
