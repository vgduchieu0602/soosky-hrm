import { AxiosError } from "axios";

/**
 * Lấy thông điệp lỗi đọc được từ một lỗi API.
 *
 * Backend trả envelope lỗi PHẲNG: `{ code, message }` — không có `{ error: {...} }`
 * và thành công thì KHÔNG bọc envelope. Vẫn đọc thêm dạng lồng cũ để không vỡ
 * nếu gặp response của phiên bản cũ, nhưng dạng phẳng là hợp đồng hiện hành.
 */
export function apiErrorMessage(err: unknown, fallback = "Đã có lỗi xảy ra. Vui lòng thử lại."): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as
      | { message?: string; code?: string; error?: { message?: string } }
      | undefined;
    if (body?.message) return body.message;
    if (body?.error?.message) return body.error.message;
    if (err.message === "Network Error") return "Không kết nối được máy chủ. Vui lòng thử lại.";
  }
  return fallback;
}

/** Mã lỗi nghiệp vụ (`code` trong envelope) — dùng khi UI phải phân nhánh theo lỗi. */
export function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const body = err.response?.data as { code?: string } | undefined;
    return body?.code;
  }
  return undefined;
}
