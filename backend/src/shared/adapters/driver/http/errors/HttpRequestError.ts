/**
 * Lỗi phát sinh ngay tại tầng HTTP adapter, trước khi request chạm tới
 * use-case (request sai schema, thiếu thông tin xác thực, ...).
 *
 * Cùng hình dạng với `DomainError`/`ApplicationError` (`code` + `httpStatus`)
 * để error handler dịch mọi loại lỗi theo một đường duy nhất.
 */
export default abstract class HttpRequestError extends Error {
    abstract readonly code:       string;
    abstract readonly httpStatus: number;

    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}
