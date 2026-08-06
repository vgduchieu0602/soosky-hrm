import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@core/http/axios", () => ({ default: api }));

import { dashboardService } from "@features/dashboard/services/dashboard.service";

/** DTO tối thiểu; từng test ghi đè phần nó quan tâm. */
function overviewDto(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-08-06T02:00:00.000Z",
    timezone: "Asia/Ho_Chi_Minh",
    scope: "all",
    headcount: {
      total: 4,
      active: 3,
      newHiresThisMonth: 1,
      byDepartment: [{ departmentId: "dept-1", name: "Engineering", count: 2 }],
    },
    attendanceToday: { date: "2026-08-06", present: 2, late: 1, incomplete: 0, onLeave: 1, absent: 0, notRecorded: 3 },
    attendanceTrend: {
      last7Days: [
        { date: "2026-08-05", present: 3, late: 0, incomplete: 0, onLeave: 0, absent: 0, notRecorded: 0 },
        { date: "2026-08-06", present: 2, late: 1, incomplete: 0, onLeave: 1, absent: 0, notRecorded: 3 },
      ],
      last30Days: [
        { date: "2026-07-08", present: 4, late: 0, incomplete: 0, onLeave: 0, absent: 0, notRecorded: 0 },
      ],
    },
    pendingApprovals: {
      leaveRequests: 2,
      correctionRequests: 1,
      leaveItems: [{
        id: "leave-1", employeeId: "emp-1", employeeCode: "EMP-001", employeeName: "Nguyen Van A",
        leaveType: "annual", startDate: "2026-08-10", endDate: "2026-08-11", days: 2,
        submittedAt: "2026-08-05T03:00:00.000Z",
      }],
    },
    upcomingLeaves: [{
      id: "leave-2", employeeId: "emp-2", employeeCode: "EMP-002", employeeName: "Tran Thi B",
      leaveType: "sick", startDate: "2026-08-20", endDate: "2026-08-20", days: 1,
      submittedAt: "2026-08-06T03:00:00.000Z",
    }],
    payroll: {
      periodId: "period-1", name: "2026-08", stage: "approved", status: "processing",
      payDate: "2026-09-05", headcount: 4,
      totals: { gross: 80_000_000, net: 68_000_000, finalizedCount: 3 },
    },
    myPayslip: { periodName: "2026-08", status: "approved", netSalary: 17_000_000 },
    performance: { cycleId: "cycle-1", cycleStatus: "active", lockedCount: 18, pendingCount: 2 },
    auditActivity: [{
      id: "audit-1", actorUserId: "user-1", resource: "payroll_variance", action: "sign",
      resourceId: "0198f0aa-1234-7000-8000-abcdef123456", occurredAt: "2026-08-06T02:00:00.000Z",
    }],
    ...overrides,
  };
}

describe("dashboardService.overview — một endpoint duy nhất", () => {
  beforeEach(() => vi.resetAllMocks());

  it("gọi ĐÚNG một lần `/dashboard/overview`, không ghép API nào khác", async () => {
    api.get.mockResolvedValueOnce({ data: overviewDto() });

    await dashboardService.overview();

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/dashboard/overview");

    // Không còn tự ghép Employee/Attendance/Payroll/IAM như bản cũ.
    const urls = api.get.mock.calls.map(([url]) => url as string);
    for (const legacy of ["/employee/employees", "/attendance/records/visible", "/payroll/periods", "/iam/audit-logs", "/department/departments"]) {
      expect(urls).not.toContain(legacy);
    }
  });

  it("giữ phạm vi + timezone của backend, không tự suy", async () => {
    api.get.mockResolvedValueOnce({ data: overviewDto({ scope: "team", timezone: "Asia/Bangkok" }) });

    const overview = await dashboardService.overview();

    expect(overview.scope).toBe("team");
    expect(overview.timezone).toBe("Asia/Bangkok");
    expect(overview.generatedAt).toBe("2026-08-06T02:00:00.000Z");
  });

  it("map KPI, phòng ban và chấm công hôm nay sang hình dạng UI", async () => {
    api.get.mockResolvedValueOnce({ data: overviewDto() });

    const overview = await dashboardService.overview();

    expect(overview.kpis).toMatchObject({
      totalEmployees: 4, activeEmployees: 3, newHiresThisMonth: 1,
      onLeaveToday: 1, pendingLeaves: 2, lateToday: 1,
    });
    expect(overview.departments).toEqual([{ name: "Engineering", count: 2 }]);
    expect(overview.attendanceToday).toEqual({ onTime: 2, late: 1, onLeave: 1, notChecked: 3 });
  });

  it("xu hướng 7/30 ngày dựng từ đúng chuỗi backend trả", async () => {
    api.get.mockResolvedValueOnce({ data: overviewDto() });

    const overview = await dashboardService.overview();

    expect(overview.attendanceTrend.week).toEqual({ labels: ["08-05", "08-06"], attend: [3, 3], late: [0, 1] });
    expect(overview.attendanceTrend.month.labels).toEqual(["07-08"]);
  });

  it("hàng chờ + đơn sắp tới: ngày đã theo timezone công ty, KHÔNG có lý do nghỉ", async () => {
    api.get.mockResolvedValueOnce({ data: overviewDto() });

    const overview = await dashboardService.overview();

    expect(overview.pendingLeaves[0]).toMatchObject({
      id: "leave-1", name: "Nguyen Van A", code: "EMP-001", type: "Phép năm",
      duration: "2 ngày", range: "10/08/2026 – 11/08/2026",
    });
    expect(overview.upcomingLeaves[0]).toMatchObject({ id: "leave-2", type: "Nghỉ ốm", range: "20/08/2026 – 20/08/2026" });
    expect(JSON.stringify(overview)).not.toContain("reason");
  });

  it("payroll: tỷ lệ hoàn tất và khấu trừ tính từ tổng backend trả", async () => {
    api.get.mockResolvedValueOnce({ data: overviewDto() });

    const overview = await dashboardService.overview();

    expect(overview.payroll).toMatchObject({
      period: "2026-08", status: "approved", totalRaw: 68_000_000, computedRatio: 75, payDate: "05/09/2026",
    });
    expect(overview.payroll?.breakdown).toEqual([
      { label: "Tổng thu nhập", value: (80_000_000).toLocaleString("vi-VN") },
      { label: "Khấu trừ", value: (12_000_000).toLocaleString("vi-VN"), tone: "neg" },
    ]);
  });
});

describe("dashboardService.overview — phạm vi và quyền", () => {
  beforeEach(() => vi.resetAllMocks());

  it("phạm vi team: không có tổng lương, không có nhật ký -> UI để trống trung thực", async () => {
    api.get.mockResolvedValueOnce({
      data: overviewDto({
        scope: "team",
        payroll: null,
        auditActivity: null,
        performance: { reviewsToScore: 3 },
      }),
    });

    const overview = await dashboardService.overview();

    expect(overview.payroll).toBeNull();
    // Không được xem nhật ký -> danh sách rỗng, KHÔNG bịa dòng nào.
    expect(overview.activities).toEqual([]);
    expect(overview.performance).toEqual({ reviewsToScore: 3 });
    expect(overview.kpis.payrollThisMonth).toEqual({ total: "0", period: "—" });
  });

  it("phạm vi self: headcount/pendingApprovals null -> KPI về 0, không suy ra số", async () => {
    api.get.mockResolvedValueOnce({
      data: overviewDto({
        scope: "self",
        headcount: null,
        pendingApprovals: null,
        payroll: null,
        auditActivity: null,
        performance: { myReviewStatus: "acknowledged" },
        upcomingLeaves: [],
      }),
    });

    const overview = await dashboardService.overview();

    expect(overview.kpis).toMatchObject({ totalEmployees: 0, activeEmployees: 0, newHiresThisMonth: 0, pendingLeaves: 0 });
    expect(overview.departments).toEqual([]);
    expect(overview.pendingLeaves).toEqual([]);
    expect(overview.upcomingLeaves).toEqual([]);
    expect(overview.myPayslip).toMatchObject({ netSalary: 17_000_000 });
    expect(overview.performance).toEqual({ myReviewStatus: "acknowledged" });
  });

  it("hệ thống trắng: mọi nhánh rỗng, payroll null, không lỗi", async () => {
    api.get.mockResolvedValueOnce({
      data: overviewDto({
        headcount: { total: 0, active: 0, newHiresThisMonth: 0, byDepartment: [] },
        attendanceToday: { date: "2026-08-06", present: 0, late: 0, incomplete: 0, onLeave: 0, absent: 0, notRecorded: 0 },
        attendanceTrend: { last7Days: [], last30Days: [] },
        pendingApprovals: { leaveRequests: 0, correctionRequests: 0, leaveItems: [] },
        upcomingLeaves: [],
        payroll: null,
        myPayslip: null,
        performance: null,
        auditActivity: [],
      }),
    });

    const overview = await dashboardService.overview();

    expect(overview.kpis.totalEmployees).toBe(0);
    expect(overview.attendanceTrend.week).toEqual({ labels: [], attend: [], late: [] });
    expect(overview.payroll).toBeNull();
    expect(overview.myPayslip).toBeNull();
    expect(overview.performance).toBeNull();
    expect(overview.activities).toEqual([]);
    expect(overview.performers).toEqual([]);
  });

  it("403 thiếu quyền dashboard:read -> lỗi nổi ra ngoài cho UI hiện thông báo", async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error("Request failed"), {
      response: { status: 403, data: { code: "ACCESS_DENIED", message: "Không có quyền" } },
    }));

    await expect(dashboardService.overview()).rejects.toMatchObject({
      response: { data: { code: "ACCESS_DENIED" } },
    });
  });

  it("KHÔNG có bảng xếp hạng nhân sự trong payload", async () => {
    api.get.mockResolvedValueOnce({ data: overviewDto() });

    const overview = await dashboardService.overview();

    expect(overview.performers).toEqual([]);
    expect(JSON.stringify(overview)).not.toContain("leaderboard");
  });
});
