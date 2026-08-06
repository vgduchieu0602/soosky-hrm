import HttpRequestError from "@shared/adapters/driver/http/errors/HttpRequestError";

/**
 * Account còn đang dùng mật khẩu TẠM (hệ thống sinh và gửi qua mail) nên chưa
 * được phép làm gì khác ngoài đổi mật khẩu.
 *
 * 403 chứ không 401: token hợp lệ, danh tính đã xác thực — chỉ là còn một bước
 * bắt buộc chưa hoàn tất. Client nhận `code` này thì điều hướng người dùng sang
 * trang đổi mật khẩu, KHÔNG đăng xuất.
 */
export default class PasswordChangeRequiredError extends HttpRequestError {
    readonly code = "PASSWORD_CHANGE_REQUIRED";
    readonly httpStatus = 403;

    constructor() {
        super("Temporary password must be changed before using the system");
    }
}
