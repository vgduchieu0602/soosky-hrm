import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@core/store/auth.store";
import { authService } from "@features/auth/services/auth.service";
import { LoadingScreen } from "@core/auth/LoadingScreen";

/**
 * Khôi phục phiên MỘT LẦN khi ứng dụng khởi động.
 *
 * ```
 * có access token trong bộ nhớ?  ── không ─→ POST /auth/refresh ─ thất bại ─→ chưa đăng nhập
 *            │ có                                   │ thành công
 *            ▼                                      ▼
 *      GET /auth/me  ←────────────── lưu token ─────┘
 *            │ 401 → refresh MỘT lần → thử lại /auth/me
 *            ▼
 *      đã đăng nhập
 * ```
 *
 * Toàn bộ việc khôi phục nằm ở đây, không nằm trong `ProtectedRoute`: nếu mỗi
 * route tự khôi phục thì sẽ có nhiều lời gọi refresh chồng nhau và vòng chuyển
 * hướng. Trong lúc chờ, ứng dụng chỉ vẽ màn hình chờ trung tính — không vẽ trang
 * cần đăng nhập, cũng không đá về trang đăng nhập.
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const [ready, setReady] = useState(false);
  // React StrictMode chạy effect hai lần ở dev — chốt lại để chỉ khôi phục một lần.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void restoreSession().finally(() => setReady(true));
  }, []);

  if (!ready || status === "initializing") return <LoadingScreen />;
  return <>{children}</>;
}

/**
 * Khôi phục phiên từ cookie refresh (nếu còn) rồi lấy danh tính chuẩn.
 * Mọi nhánh thất bại đều kết thúc ở `unauthenticated` — không ném ra ngoài.
 */
async function restoreSession(): Promise<void> {
  const store = useAuthStore.getState();

  try {
    if (!store.accessToken) {
      // Không có token trong bộ nhớ (mới tải lại trang) — thử cookie refresh.
      const { accessToken } = await authService.refresh();
      store.setAccessToken(accessToken);
    }

    const user = await authService.me();
    useAuthStore.getState().setSession(useAuthStore.getState().accessToken ?? "", user);
  } catch {
    useAuthStore.getState().markUnauthenticated();
  }
}
