import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "@layouts/MainLayout";
import AuthLayout from "@layouts/AuthLayout";
import LoginPage from "@pages/LoginPage";
import DashboardPage from "@pages/DashboardPage";
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
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
