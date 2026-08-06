import { Navigate } from "react-router-dom";
import { useAuthStore } from "@core/store/auth.store";
import { LazyRoute } from "./LazyRoute";
import { DashboardPage } from "./lazyPages";

/**
 * Bảng điều khiển ghép số liệu toàn công ty (nhân viên, chấm công, nghỉ phép,
 * kỳ lương) — nhân viên thường chỉ nhận 403 ở phần lớn nguồn, nên đưa họ về
 * trang tự phục vụ thay vì hiện một trang rỗng.
 */
export default function DashboardByRole() {
  const user = useAuthStore((s) => s.user);
  const isManager = (user?.roles ?? []).some((r) => r === "admin" || r === "hr_manager");

  if (!isManager) return <Navigate to="/me/attendance" replace />;
  return <LazyRoute><DashboardPage /></LazyRoute>;
}
