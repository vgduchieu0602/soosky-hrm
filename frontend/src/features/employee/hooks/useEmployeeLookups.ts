import { useEffect, useState } from "react";
import { employeeService } from "@features/employee/services/employee.service";
import { organizationService } from "@features/organization/services/organization.service";
import { attendanceService } from "@features/attendance/services/attendance.service";
import { toEmployeeView } from "@features/employee/constants";
import type { EmployeeLookups } from "@features/employee/components/EmployeeFormFields";

/**
 * Nạp danh mục phòng ban / chức vụ / quản lý / ca làm việc dùng cho biểu mẫu
 * nhân viên. Mỗi mục mang theo cả `id` (để `<select>` hiển thị) lẫn `code` (để
 * đổi ngược về dữ liệu CSV khi sửa dòng import).
 */
export function useEmployeeLookups(): EmployeeLookups {
  const [lookups, setLookups] = useState<EmployeeLookups>({
    departments: [], positions: [], managers: [], shifts: [],
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      organizationService.departmentsFlat().catch(() => []),
      organizationService.positions().catch(() => []),
      employeeService.list({ limit: 200, status: "active" }).catch(() => ({ items: [] })),
      attendanceService.shifts().catch(() => []),
    ]).then(([departments, positions, employees, shifts]) => {
      if (cancelled) return;
      setLookups({
        departments: departments.map((d) => ({ id: d.id, name: d.name, code: d.code })),
        positions: positions.map((p) => ({
          id: p._id, title: p.title, departmentId: p.departmentId, code: p.code,
        })),
        managers: employees.items.map((r) => {
          const view = toEmployeeView(r);
          return { id: view.id, name: `${view.fullName} · ${view.code}`, code: view.code };
        }),
        shifts: shifts
          .filter((s) => s.status !== "archived")
          .map((s) => ({ id: s._id, name: s.name })),
      });
    });
    return () => { cancelled = true; };
  }, []);

  return lookups;
}
