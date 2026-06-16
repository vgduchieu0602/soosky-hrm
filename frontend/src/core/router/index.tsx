import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "@layouts/MainLayout";
import AuthLayout from "@layouts/AuthLayout";
import LoginPage from "@pages/LoginPage";
import SetPasswordPage from "@pages/SetPasswordPage";
import DashboardPage from "@pages/DashboardPage";
import EmployeesPage from "@pages/EmployeesPage";
import DepartmentsPage from "@pages/DepartmentsPage";
import AttendancePage from "@pages/AttendancePage";
import LeavePage from "@pages/LeavePage";
import PayrollPage from "@pages/PayrollPage";
import PerformancePage from "@pages/PerformancePage";
import SettingsPage from "@pages/SettingsPage";
import SystemSettingsPage from "@features/settings/components/SystemSettingsPage";
import NotFoundPage from "@pages/NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "set-password", element: <SetPasswordPage /> },
    ],
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "employees", element: <EmployeesPage /> },
          { path: "departments", element: <DepartmentsPage /> },
          { path: "attendance", element: <AttendancePage /> },
          { path: "leave", element: <LeavePage /> },
          { path: "payroll", element: <PayrollPage /> },
          { path: "performance", element: <PerformancePage /> },
          { path: "settings", element: <SystemSettingsPage /> },
          { path: "settings/account", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
