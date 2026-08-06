import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "@layouts/MainLayout";
import AuthLayout from "@layouts/AuthLayout";
import LoginPage from "@pages/LoginPage";
import SetPasswordPage from "@pages/SetPasswordPage";
import ChangePasswordPage from "@pages/ChangePasswordPage";
import NotFoundPage from "@pages/NotFoundPage";
import DashboardByRole from "./DashboardByRole";
import AttendanceByRole from "./AttendanceByRole";
import { LazyRoute } from "./LazyRoute";
import { ProtectedRoute } from "./ProtectedRoute";
import { MustChangePasswordRoute } from "./MustChangePasswordRoute";
import { RoleRoute } from "./RoleRoute";
import {
  AccountSettingsPage,
  DepartmentsPage,
  EmployeesPage,
  LeavePage,
  MyAttendancePage,
  MyEvaluationsPage,
  MyPayslipsPage,
  PayrollPage,
  PerformancePage,
  SystemSettingsPage,
} from "./lazyPages";

/**
 * Mỗi trang nặng được bọc `LazyRoute` (Suspense + fallback lỗi chunk). Bọc ở
 * TỪNG route thay vì một lần ở layout để trang này lỗi/đang tải không làm trắng
 * cả khung ứng dụng, và để thứ tự guard giữ nguyên:
 * `ProtectedRoute` → `MustChangePasswordRoute` → `MainLayout` → `RoleRoute`.
 */
export const router = createBrowserRouter([
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      // Ba trang này KHÔNG lazy: là màn hình đầu tiên người dùng thấy.
      { path: "login", element: <LoginPage /> },
      { path: "set-password", element: <SetPasswordPage /> },
      { path: "change-password", element: <ChangePasswordPage /> },
    ],
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <MustChangePasswordRoute />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: "dashboard", element: <DashboardByRole /> },
              { path: "attendance", element: <AttendanceByRole /> },
              { path: "me/attendance", element: <LazyRoute><MyAttendancePage /></LazyRoute> },
              { path: "me/payslips", element: <LazyRoute><MyPayslipsPage /></LazyRoute> },
              { path: "me/evaluations", element: <LazyRoute><MyEvaluationsPage /></LazyRoute> },
              { path: "leave", element: <LazyRoute><LeavePage /></LazyRoute> },
              { path: "settings/account", element: <LazyRoute><AccountSettingsPage /></LazyRoute> },
              // HR / Admin only — nhân viên bị đưa về dashboard.
              {
                element: <RoleRoute roles={["admin", "hr_manager"]} />,
                children: [
                  { path: "employees", element: <LazyRoute><EmployeesPage /></LazyRoute> },
                  { path: "departments", element: <LazyRoute><DepartmentsPage /></LazyRoute> },
                  { path: "payroll", element: <LazyRoute><PayrollPage /></LazyRoute> },
                  { path: "performance", element: <LazyRoute><PerformancePage /></LazyRoute> },
                  { path: "settings", element: <LazyRoute><SystemSettingsPage /></LazyRoute> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
