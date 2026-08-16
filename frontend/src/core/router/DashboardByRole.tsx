import { hasAnyRole, MANAGEMENT_ROLES, useAuthStore } from "@core/store/auth.store";
import ManagementDashboardPage from "@features/dashboard/components/DashboardPage";
import EmployeeDashboardPage from "@features/dashboard/components/EmployeeDashboardPage";

/**
 * `/dashboard` là lối vào chung cho MỌI người đã đăng nhập, nhưng nội dung phải
 * khác nhau theo vai trò.
 *
 * Trước đây ai vào cũng gọi `GET /admin/dashboard` — endpoint chỉ dành cho
 * HR/Admin — nên nhân viên thường luôn nhận 403 ngay màn hình đầu tiên. Cách
 * sửa KHÔNG phải là mở dữ liệu toàn công ty cho nhân viên, mà là cho họ bảng
 * điều khiển tự phục vụ dựng từ các endpoint `/me` sẵn có.
 */
export default function DashboardByRole() {
  const user = useAuthStore((s) => s.user);

  return hasAnyRole(user, MANAGEMENT_ROLES) ? <ManagementDashboardPage /> : <EmployeeDashboardPage />;
}
