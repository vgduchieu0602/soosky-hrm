import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@core/store/auth.store";
import { LoadingScreen } from "@core/auth/LoadingScreen";

/**
 * Cổng vào phần ứng dụng cần đăng nhập, quyết định theo TRẠNG THÁI xác thực chứ
 * không theo việc "có chuỗi token hay không" — token có thể đã hết hạn, bị thu
 * hồi, hoặc còn sót từ phiên trước.
 *
 * Route này KHÔNG tự khôi phục phiên; việc đó là của `AuthBootstrap`. Nếu mỗi
 * route tự gọi refresh sẽ sinh nhiều lời gọi chồng nhau và vòng chuyển hướng.
 */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);

  if (status === "initializing") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/auth/login" replace />;
  return <Outlet />;
}
