import ApplicationError from "@shared/core/app/errors/ApplicationError";

/**
 * Chưa có hồ sơ ngân hàng nào được bật trong Cài đặt.
 *
 * 409 chứ không 404: hồ sơ không "không tìm thấy", mà là còn một bước cấu hình
 * chưa làm — thông điệp phải chỉ người dùng sang đúng chỗ.
 */
export default class BankTransferProfileMissingError extends ApplicationError {
    readonly code       = "PAYROLL_BANK_PROFILE_MISSING";
    readonly httpStatus = 409;

    constructor() {
        super("No active bank transfer profile configured in Settings");
    }
}
