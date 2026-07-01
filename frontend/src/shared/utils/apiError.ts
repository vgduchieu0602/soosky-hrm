import { AxiosError } from "axios";

/**
 * Pull a human-readable message out of an API error. The backend error
 * envelope is `{ success: false, error: { code?, message } }`. Falls back to
 * the provided default. Use with `toast.error(apiErrorMessage(err, "…"))`.
 */
export function apiErrorMessage(err: unknown, fallback = "Đã có lỗi xảy ra. Vui lòng thử lại."): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as { error?: { message?: string } } | undefined;
    if (body?.error?.message) return body.error.message;
    if (err.message === "Network Error") return "Không kết nối được máy chủ. Vui lòng thử lại.";
  }
  return fallback;
}
