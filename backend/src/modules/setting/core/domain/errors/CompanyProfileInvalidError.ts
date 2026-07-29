import DomainError from "@shared/core/domain/DomainError";

/**
 * Lỗi validate dùng chung cho mọi field của `CompanyProfile` (tên, múi giờ,
 * đơn vị tiền tệ, giờ/ngày công chuẩn, ...) — mỗi field không hợp lệ đều ném
 * lỗi này kèm lý do cụ thể trong message.
 */
export default class CompanyProfileInvalidError extends DomainError {
    readonly code       = "COMPANY_PROFILE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
