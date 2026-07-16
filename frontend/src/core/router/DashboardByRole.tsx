import { Navigate } from "react-router-dom";
import DashboardPage from "@pages/DashboardPage";
import { useAuthStore } from "@core/store/auth.store";

/**
 * Dashboard aggregates admin-only data (GET /admin/dashboard); employees would
 * only hit a 403, so send them to their self-service home instead.
 */
export default function DashboardByRole() {
  const user = useAuthStore((s) => s.user);
  const isManager = (user?.roles ?? []).some((r) => r === "admin" || r === "hr_manager");
  return isManager ? <DashboardPage /> : <Navigate to="/me/attendance" replace />;
}
