import DomainError from "@shared/core/domain/DomainError";

/**
 * Lỗi hợp lệ hoá dùng chung cho các mục danh mục lương (phụ cấp/thưởng/khấu
 * trừ/hồ sơ thuế/chính sách lương) — tái dùng một class cho nhiều kiểm tra
 * trường đơn giản, giống cách `EmployeeSubResourceInvalidError` được dùng
 * chung cho các sub-resource của module Employee.
 */
export default class CompensationCatalogInvalidError extends DomainError {
    readonly code       = "COMPENSATION_CATALOG_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
