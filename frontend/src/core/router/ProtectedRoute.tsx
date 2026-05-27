import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@core/store/auth.store";

export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  return token ? <Outlet /> : <Navigate to="/auth/login" replace />;
}
