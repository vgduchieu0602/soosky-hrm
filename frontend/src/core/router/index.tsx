import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "@layouts/MainLayout";
import AuthLayout from "@layouts/AuthLayout";
import LoginPage from "@pages/LoginPage";
import SetPasswordPage from "@pages/SetPasswordPage";
import DashboardPage from "@pages/DashboardPage";
import EmployeesPage from "@pages/EmployeesPage";
import DepartmentsPage from "@pages/DepartmentsPage";
import MyAttendancePage from "@features/attendance/components/MyAttendancePage";
import MyPayslipsPage from "@features/payroll/components/MyPayslipsPage";
import MyEvaluationsPage from "@features/performance/components/MyEvaluationsPage";
import LeavePage from "@pages/LeavePage";
import AttendanceByRole from "./AttendanceByRole";
import PayrollPage from "@pages/PayrollPage";
import PerformancePage from "@pages/PerformancePage";
import SettingsPage from "@pages/SettingsPage";
import SystemSettingsPage from "@features/settings/components/SystemSettingsPage";
import NotFoundPage from "@pages/NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleRoute } from "./RoleRoute";

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
          { path: "attendance", element: <AttendanceByRole /> },
          { path: "me/attendance", element: <MyAttendancePage /> },
          { path: "me/payslips", element: <MyPayslipsPage /> },
          { path: "me/evaluations", element: <MyEvaluationsPage /> },
          { path: "leave", element: <LeavePage /> },
          { path: "settings/account", element: <SettingsPage /> },
          // HR / Admin only — employees are redirected to the dashboard.
          {
            element: <RoleRoute roles={["admin", "hr_manager"]} />,
            children: [
              { path: "employees", element: <EmployeesPage /> },
              { path: "departments", element: <DepartmentsPage /> },
              { path: "payroll", element: <PayrollPage /> },
              { path: "performance", element: <PerformancePage /> },
              { path: "settings", element: <SystemSettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
