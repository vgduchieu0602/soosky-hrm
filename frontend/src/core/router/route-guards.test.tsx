import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Các cổng route: chặn theo TRẠNG THÁI xác thực và theo vai trò.
 *
 * Điều được khoá: lúc chưa biết thì chỉ vẽ màn hình chờ (không chớp sang trang
 * đăng nhập); nhân viên thường không mở được trang quản lý; và bảng điều khiển
 * của nhân viên KHÔNG gọi endpoint chỉ dành cho HR/Admin.
 */

const dashboardService = vi.hoisted(() => ({ overview: vi.fn() }));
const attendanceService = vi.hoisted(() => ({
  myMonth: vi.fn(), myLeaves: vi.fn(), myBalances: vi.fn(), shifts: vi.fn(),
}));
const payrollService = vi.hoisted(() => ({ myPayslips: vi.fn() }));
const performanceService = vi.hoisted(() => ({ mine: vi.fn() }));

vi.mock("@features/dashboard/services/dashboard.service", () => ({ dashboardService }));
vi.mock("@features/attendance/services/attendance.service", () => ({ attendanceService }));
vi.mock("@features/payroll/services/payroll.service", () => ({ payrollService }));
vi.mock("@features/performance/services/performance.service", () => ({ performanceService }));
vi.mock("@features/auth/services/auth.service", () => ({ authService: { logout: vi.fn() } }));

import { ProtectedRoute } from "@core/router/ProtectedRoute";
import { RoleRoute } from "@core/router/RoleRoute";
import DashboardByRole from "@core/router/DashboardByRole";
import { useAuthStore, type AuthStatus } from "@core/store/auth.store";
import type { AuthUser } from "@features/auth/types/auth.types";

function user(roles: string[]): AuthUser {
  return { id: "u1", username: "u", email: "u@x.co", roles, permissions: [], mustChangePassword: false };
}

function setAuth(status: AuthStatus, roles: string[] = []) {
  useAuthStore.setState({
    status,
    accessToken: status === "authenticated" ? "tok" : null,
    user: status === "authenticated" ? user(roles) : null,
  });
}

function renderProtected(initial = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>WORKSPACE</div>} />
        </Route>
        <Route path="/auth/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  attendanceService.myMonth.mockResolvedValue({ employeeId: "e1", month: "2026-08", records: [] });
  attendanceService.myLeaves.mockResolvedValue([]);
  attendanceService.myBalances.mockResolvedValue([]);
  attendanceService.shifts.mockResolvedValue([]);
  payrollService.myPayslips.mockResolvedValue([]);
  performanceService.mine.mockResolvedValue([]);
  dashboardService.overview.mockResolvedValue({});
});

describe("ProtectedRoute", () => {
  it("initializing → màn hình chờ, không vẽ workspace, không đá về login", () => {
    setAuth("initializing");

    renderProtected();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("WORKSPACE")).not.toBeInTheDocument();
    expect(screen.queryByText("LOGIN")).not.toBeInTheDocument();
  });

  it("unauthenticated → trang đăng nhập", () => {
    setAuth("unauthenticated");

    renderProtected();

    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });

  it("authenticated → vẽ nội dung bên trong", () => {
    setAuth("authenticated", ["employee"]);

    renderProtected();

    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
  });

  it("mất phiên giữa chừng → tự chuyển về đăng nhập, không cần tải lại trang", () => {
    setAuth("authenticated", ["employee"]);
    renderProtected();
    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();

    act(() => useAuthStore.getState().markUnauthenticated());

    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });
});

describe("RoleRoute", () => {
  function renderRole(roles: string[], allowed: string[]) {
    setAuth("authenticated", roles);
    return render(
      <MemoryRouter initialEntries={["/employees"]}>
        <Routes>
          <Route element={<RoleRoute roles={allowed} />}>
            <Route path="/employees" element={<div>MANAGEMENT</div>} />
          </Route>
          <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("nhân viên thường KHÔNG mở được trang quản lý", () => {
    renderRole(["employee"], ["admin", "hr_manager"]);

    expect(screen.queryByText("MANAGEMENT")).not.toBeInTheDocument();
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
  });

  it("admin mở được trang quản lý", () => {
    renderRole(["admin"], ["admin", "hr_manager"]);

    expect(screen.getByText("MANAGEMENT")).toBeInTheDocument();
  });

  it("hr_manager mở được trang HR", () => {
    renderRole(["hr_manager"], ["admin", "hr_manager"]);

    expect(screen.getByText("MANAGEMENT")).toBeInTheDocument();
  });
});

describe("DashboardByRole", () => {
  function renderDashboard(roles: string[]) {
    setAuth("authenticated", roles);
    return render(
      <MemoryRouter>
        <DashboardByRole />
      </MemoryRouter>,
    );
  }

  it("admin → bảng điều khiển quản lý (gọi /admin/dashboard)", async () => {
    renderDashboard(["admin"]);

    await vi.waitFor(() => expect(dashboardService.overview).toHaveBeenCalled());
    expect(payrollService.myPayslips).not.toHaveBeenCalled();
  });

  it("hr_manager → bảng điều khiển quản lý", async () => {
    renderDashboard(["hr_manager"]);

    await vi.waitFor(() => expect(dashboardService.overview).toHaveBeenCalled());
  });

  it("nhân viên → bảng tự phục vụ, KHÔNG bao giờ gọi /admin/dashboard", async () => {
    renderDashboard(["employee"]);

    await vi.waitFor(() => expect(payrollService.myPayslips).toHaveBeenCalled());
    expect(attendanceService.myLeaves).toHaveBeenCalled();
    expect(performanceService.mine).toHaveBeenCalled();
    expect(dashboardService.overview).not.toHaveBeenCalled();
  });
});
