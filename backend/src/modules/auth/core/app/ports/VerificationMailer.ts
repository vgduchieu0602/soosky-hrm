import IssuedToken from "@modules/auth/core/app/ports/IssuedToken";
import Email from "@shared/core/domain/value-objects/email/Email";

/**
 * Cổng gửi mail xác minh tài khoản (driven port).
 *
 * Hiện thực ở tầng hạ tầng tự quyết định kênh gửi (SMTP, dịch vụ mail bên
 * thứ ba, console cho môi trường phát triển...) và nội dung/khuôn mẫu mail —
 * use-case chỉ cung cấp người nhận, mật khẩu khởi tạo và token xác minh.
 */
export default interface VerificationMailer {
    sendVerificationMail(recipient: Email, generatedPassword: string, verification: IssuedToken): Promise<void>;
}
