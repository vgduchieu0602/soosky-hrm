import { Navigate } from "react-router-dom";
import { useAuthStore } from "@core/store/auth.store";
import { LazyRoute } from "./LazyRoute";
import { AttendancePage } from "./lazyPages";

/** Lưới chấm công là của HR/admin; nhân viên xem bảng công của chính mình. */
export default function AttendanceByRole() {
  const user = useAuthStore((s) => s.user);
  const isManager = (user?.roles ?? []).some((r) => r === "admin" || r === "hr_manager");

  if (!isManager) return <Navigate to="/me/attendance" replace />;
  return <LazyRoute><AttendancePage /></LazyRoute>;
}
