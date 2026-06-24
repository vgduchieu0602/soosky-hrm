import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@core/store/auth.store";

/**
 * Gate a route subtree by role. Employees without an allowed role are redirected
 * to the dashboard (the backend also enforces this — UI gating is for UX/safety).
 */
export function RoleRoute({ roles }: { roles: string[] }) {
  const user = useAuthStore((s) => s.user);
  const allowed = (user?.roles ?? []).some((r) => roles.includes(r));
  return allowed ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
