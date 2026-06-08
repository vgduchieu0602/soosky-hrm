import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "@layouts/MainLayout";
import AuthLayout from "@layouts/AuthLayout";
import LoginPage from "@pages/LoginPage";
import DashboardPage from "@pages/DashboardPage";
import EmployeesPage from "@pages/EmployeesPage";
import DepartmentsPage from "@pages/DepartmentsPage";
import AttendancePage from "@pages/AttendancePage";
import LeavePage from "@pages/LeavePage";
import SettingsPage from "@pages/SettingsPage";
import NotFoundPage from "@pages/NotFoundPage";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [{ path: "login", element: <LoginPage /> }],
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
          { path: "settings", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
