import PasswordInvalidError from "@modules/auth/core/domain/errors/PasswordInvalidError";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Mật khẩu thô người dùng nhập, chỉ sống trong bộ nhớ cho tới khi được băm —
 * không bao giờ được lưu trữ hay ghi log.
 *
 * Không trim: khoảng trắng là ký tự hợp lệ của mật khẩu. Chặn dưới để loại
 * mật khẩu quá yếu, chặn trên để giới hạn input cho hàm băm.
 *
 * Chỉ áp dụng khi đặt/đổi mật khẩu; lúc đăng nhập thì so hash trực tiếp với
 * chuỗi thô để mật khẩu cũ (đặt trước khi siết quy tắc) vẫn đăng nhập được.
 */
export default class PlainPassword {
    private constructor(
        public readonly value: string
    ) {}

    static create(raw: string): PlainPassword {
        if (raw.length < MIN_LENGTH) {
            throw new PasswordInvalidError(`Password must be at least ${MIN_LENGTH} characters`);
        }
        if (raw.length > MAX_LENGTH) {
            throw new PasswordInvalidError(`Password must be at most ${MAX_LENGTH} characters`);
        }
        return new PlainPassword(raw);
    }
}
