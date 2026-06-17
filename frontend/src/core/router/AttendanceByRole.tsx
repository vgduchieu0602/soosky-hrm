import { Navigate } from "react-router-dom";
import AttendancePage from "@pages/AttendancePage";
import { useAuthStore } from "@core/store/auth.store";

/** Attendance grid is HR/admin-only; employees see their own view. */
export default function AttendanceByRole() {
  const user = useAuthStore((s) => s.user);
  const isManager = (user?.roles ?? []).some((r) => r === "admin" || r === "hr_manager");
  return isManager ? <AttendancePage /> : <Navigate to="/me/attendance" replace />;
}
