import ApplicationError from "@shared/core/app/errors/ApplicationError";

/**
 * Người LẬP lương không được tự duyệt / tự đánh dấu đã chi trả kỳ của mình.
 *
 * Chặn ở tầng use-case, KHÔNG chỉ dựa vào việc tách khoá quyền: người giữ cả
 * `payroll:prepare` lẫn `payroll:approve` (hoặc wildcard `*` của admin) vẫn phải
 * đi qua rào này. Tách quyền là để phân vai; rào này là để nguyên tắc bốn mắt
 * không bị vô hiệu chỉ vì một tài khoản được gán nhiều quyền.
 */
export default class SelfApprovalForbiddenError extends ApplicationError {
    readonly code       = "PAYROLL_SELF_APPROVAL_FORBIDDEN";
    readonly httpStatus = 403;

    constructor(action: string) {
        super(`The user who prepared this payroll cannot ${action} it; a different authorised user must do so`);
    }
}
