import DomainError from "@shared/core/domain/DomainError";

/**
 * Lỗi validate dùng chung cho các entry của `SystemSetting` — key rỗng/quá
 * dài hoặc value không thuộc kiểu cho phép (string/number/boolean) đều ném
 * lỗi này kèm lý do cụ thể trong message.
 */
export default class SystemSettingInvalidError extends DomainError {
    readonly code       = "SYSTEM_SETTING_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
