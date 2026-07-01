import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@core/store/auth.store";

/**
 * Blocks the app until a user flagged `mustChangePassword` sets a new password.
 * Mirrors the server-side enforcement (IAM_013): without this, a first-login
 * user lands on the app but every data call is rejected, which reads as a
 * generic "can't load" error. Sits between ProtectedRoute and the app layout.
 */
export function MustChangePasswordRoute() {
  const user = useAuthStore((s) => s.user);
  if (user?.mustChangePassword) {
    return <Navigate to="/auth/change-password" replace />;
  }
  return <Outlet />;
}
