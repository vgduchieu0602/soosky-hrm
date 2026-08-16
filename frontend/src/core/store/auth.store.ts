import { create } from "zustand";
import type { AuthUser } from "@features/auth/types/auth.types";

/**
 * Trạng thái xác thực của ứng dụng.
 *
 * `initializing` là trạng thái BAN ĐẦU: chưa biết người dùng đã đăng nhập hay
 * chưa vì còn phải hỏi máy chủ. Giao diện phải chờ trạng thái này kết thúc rồi
 * mới vẽ, nếu không sẽ chớp "Đăng nhập → Dashboard → Đăng nhập".
 */
export type AuthStatus = "initializing" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  /** Access token CHỈ nằm trong bộ nhớ — xem ghi chú bên dưới. */
  accessToken: string | null;
  user: AuthUser | null;

  /** Đăng nhập/khôi phục phiên thành công. */
  setSession: (accessToken: string, user: AuthUser) => void;
  /** Token mới sau khi refresh hoặc đổi mật khẩu; không đổi trạng thái. */
  setAccessToken: (accessToken: string) => void;
  /** Thông tin người dùng chuẩn từ `/auth/me`. */
  setUser: (user: AuthUser) => void;
  /** Không có phiên hợp lệ — router sẽ tự đưa về trang đăng nhập. */
  markUnauthenticated: () => void;
}

/**
 * KHÔNG lưu access token xuống localStorage.
 *
 * Token còn nằm trong localStorage không có nghĩa là phiên còn sống: nó có thể
 * đã hết hạn, bị thu hồi, hoặc thuộc về một lần cài đặt máy chủ khác. Trước đây
 * `ProtectedRoute` tin vào chuỗi token đó nên vẽ luôn màn hình cần đăng nhập,
 * rồi request đầu tiên trả 401 và đá ngược ra login — chính là hiện tượng chớp
 * màn hình.
 *
 * Nguồn sự thật là MÁY CHỦ: refresh token nằm trong cookie httpOnly, access
 * token giữ trong bộ nhớ, còn danh tính người dùng lấy lại bằng `/auth/me` mỗi
 * lần khởi động ứng dụng.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: "initializing",
  accessToken: null,
  user: null,

  setSession: (accessToken, user) => set({ status: "authenticated", accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  markUnauthenticated: () => set({ status: "unauthenticated", accessToken: null, user: null }),
}));

/** Người dùng có ít nhất một trong các vai trò đã cho. */
export function hasAnyRole(user: AuthUser | null, roles: readonly string[]): boolean {
  return (user?.roles ?? []).some((role) => roles.includes(role));
}

/** Vai trò quản lý nhân sự — xem được dữ liệu toàn công ty. */
export const MANAGEMENT_ROLES = ["admin", "hr_manager"] as const;
