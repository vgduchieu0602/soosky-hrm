import SystemSettingInvalidError from "@modules/setting/core/domain/errors/SystemSettingInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

/** Id cố định — luôn tồn tại đúng một document `SystemSetting`. */
export const SYSTEM_SETTING_ID = "global";

const KEY_MAX_LENGTH          = 100;
const STRING_VALUE_MAX_LENGTH = 500;

export type SettingValue = string | number | boolean;

export interface SystemSettingProps {
    id:        string;
    entries:   Record<string, SettingValue>;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Cấu hình hệ thống dạng key-value — singleton (id cố định
 * `{@link SYSTEM_SETTING_ID}`) chứa mọi thiết lập chung không thuộc về
 * `CompanyProfile` hay module nghiệp vụ nào khác. Value chỉ chấp nhận
 * string/number/boolean — cấu trúc lồng nhau không được hỗ trợ.
 */
export default class SystemSetting extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _updatedAt: Date,
        private _entries: Record<string, SettingValue>,
    ) {
        super();
    }

    /** Bản sao phòng thủ — tránh mutate trực tiếp trạng thái nội bộ từ bên ngoài. */
    get entries(): Record<string, SettingValue> {
        return { ...this._entries };
    }
    get updatedAt(): Date { return this._updatedAt; }

    static create(): SystemSetting {
        const now = new Date();
        return new SystemSetting(SYSTEM_SETTING_ID, now, now, {});
    }

    static rehydrate(props: SystemSettingProps): SystemSetting {
        return new SystemSetting(props.id, props.createdAt, props.updatedAt, { ...props.entries });
    }

    /** Trộn (merge) các cặp key/value mới vào cấu hình hiện có; mỗi entry được kiểm tra hợp lệ trước khi ghi. */
    merge(patch: Record<string, unknown>): void {
        const next = { ...this._entries };
        for (const [rawKey, rawValue] of Object.entries(patch)) {
            const key = validateKey(rawKey);
            next[key] = validateValue(rawValue, key);
        }
        this._entries = next;
        this._updatedAt = new Date();
    }
}

function validateKey(raw: string): string {
    const key = raw.trim();
    if (key.length === 0) {
        throw new SystemSettingInvalidError("Setting key must not be empty");
    }
    if (key.length > KEY_MAX_LENGTH) {
        throw new SystemSettingInvalidError(`Setting key must be at most ${KEY_MAX_LENGTH} characters`);
    }
    return key;
}

function validateValue(raw: unknown, key: string): SettingValue {
    if (typeof raw === "string") {
        if (raw.length > STRING_VALUE_MAX_LENGTH) {
            throw new SystemSettingInvalidError(`Value for '${key}' must be at most ${STRING_VALUE_MAX_LENGTH} characters`);
        }
        return raw;
    }
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "boolean") return raw;

    throw new SystemSettingInvalidError(`Value for '${key}' must be a string, number, or boolean`);
}
