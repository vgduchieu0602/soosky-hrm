import DomainError from "@shared/core/domain/DomainError";

/**
 * Lỗi validate dùng chung cho các sub-resource của Employee (contact,
 * bank-account, document, contract, asset) — mỗi field bắt buộc/định dạng sai
 * đều ném lỗi này kèm lý do cụ thể trong message.
 */
export default class EmployeeSubResourceInvalidError extends DomainError {
    readonly code       = "EMPLOYEE_SUB_RESOURCE_INVALID";
    readonly httpStatus = 422;

    constructor(reason: string) {
        super(reason);
    }
}
