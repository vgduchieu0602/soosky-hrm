import { lazy } from "react";

/**
 * Các trang nặng được nạp theo nhu cầu (code splitting theo route).
 *
 * Khai ở MỘT chỗ vì hai nơi cần chúng: bảng route và các wrapper chọn trang theo
 * vai trò (`DashboardByRole`, `AttendanceByRole`). Nếu mỗi nơi tự `lazy(...)` thì
 * cùng một trang sinh hai chunk và mất chia sẻ cache.
 *
 * Trang đăng nhập / đổi mật khẩu CỐ TÌNH không lazy: chúng là màn hình đầu tiên,
 * tách chunk chỉ thêm một vòng tải trước khi người dùng thấy gì.
 */
export const DashboardPage = lazy(() => import("@features/dashboard/components/DashboardPage"));
export const EmployeesPage = lazy(() => import("@features/employee/components/EmployeesPage"));
export const DepartmentsPage = lazy(() => import("@features/organization/components/DepartmentsPage"));
export const AttendancePage = lazy(() => import("@features/attendance/components/AttendancePage"));
export const MyAttendancePage = lazy(() => import("@features/attendance/components/MyAttendancePage"));
export const LeavePage = lazy(() => import("@features/attendance/components/LeavePage"));
export const PayrollPage = lazy(() => import("@features/payroll/components/PayrollPage"));
export const MyPayslipsPage = lazy(() => import("@features/payroll/components/MyPayslipsPage"));
export const PerformancePage = lazy(() => import("@features/performance/components/PerformancePage"));
export const MyEvaluationsPage = lazy(() => import("@features/performance/components/MyEvaluationsPage"));
export const SystemSettingsPage = lazy(() => import("@features/settings/components/SystemSettingsPage"));
export const AccountSettingsPage = lazy(() => import("@features/auth/components/SettingsPage"));
