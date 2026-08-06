import GetDashboardOverviewUseCase from "@modules/dashboard/core/app/use-cases/GetDashboardOverviewUseCase";
import { DashboardSources } from "@modules/dashboard/core/app/ports/DashboardSources";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Read model bảng điều khiển.
 *
 * Điều được bảo vệ ở đây: PHẠM VI. Actor `team`/`self` không được nhận dữ liệu
 * của người ngoài phạm vi, không nhận tổng lương công ty, và `null` (không được
 * xem) phải khác `0`/`[]` (được xem nhưng rỗng).
 */

const TZ = "Asia/Ho_Chi_Minh";

interface StubOptions {
    scope:        PermissionScope;
    permissions?: string[];
    ownEmployeeId?: string | undefined;
    teamIds?:     string[];
}

function buildSources(options: StubOptions) {
    const granted = new Set(options.permissions ?? []);

    const employees = [
        { id: "emp-1", code: "EMP-001", name: "Nguyen Van A", departmentId: "dept-1", hireDate: new Date("2026-08-01T00:00:00.000Z"), status: "active" },
        { id: "emp-2", code: "EMP-002", name: "Tran Thi B",   departmentId: "dept-1", hireDate: new Date("2024-03-01T00:00:00.000Z"), status: "active" },
        { id: "emp-3", code: "EMP-003", name: "Le Van C",     departmentId: "dept-2", hireDate: new Date("2023-01-01T00:00:00.000Z"), status: "terminated" },
    ];

    const calls = {
        countByDay:              vi.fn(),
        listPending:             vi.fn(),
        listUpcomingApproved:    vi.fn(),
        countPendingCorrections: vi.fn(),
        latestPeriodSnapshot:    vi.fn(),
        listSummaries:           vi.fn(),
        listSummariesByIds:      vi.fn(),
    };

    const sources: DashboardSources = {
        permissions: {
            resolveScope: async () => options.scope,
            hasPermission: async (_actor, key) => granted.has(key),
        },
        clock: { timezone: async () => TZ },
        employees: {
            listSummaries: async () => { calls.listSummaries(); return employees; },
            listSummariesByIds: async (ids) => {
                calls.listSummariesByIds(ids);
                return employees.filter(employee => ids.includes(employee.id));
            },
            findEmployeeIdByUserId: async () => options.ownEmployeeId,
            listTeamEmployeeIds: async () => options.teamIds ?? [],
        },
        departments: { listNames: async () => [{ id: "dept-1", name: "Engineering" }, { id: "dept-2", name: "Sales" }] },
        attendance: {
            countByDay: async (range, employeeIds) => {
                calls.countByDay(range, employeeIds);
                return [{
                    date: range.to, present: 2, late: 1, incomplete: 0, onLeave: 0, absent: 0, employeeCount: 2,
                }];
            },
        },
        leaves: {
            listPending: async (employeeIds) => {
                calls.listPending(employeeIds);
                return [{
                    id: "leave-1", employeeId: "emp-1", leaveType: "annual",
                    startDate: new Date("2026-08-10T00:00:00.000Z"), endDate: new Date("2026-08-11T00:00:00.000Z"),
                    days: 2, submittedAt: new Date("2026-08-05T03:00:00.000Z"),
                }];
            },
            listUpcomingApproved: async (from, employeeIds) => {
                calls.listUpcomingApproved(from, employeeIds);
                return [{
                    id: "leave-2", employeeId: "emp-2", leaveType: "sick",
                    startDate: new Date("2026-08-20T00:00:00.000Z"), endDate: new Date("2026-08-20T00:00:00.000Z"),
                    days: 1, submittedAt: new Date("2026-08-06T03:00:00.000Z"),
                }];
            },
            countPendingCorrections: async (employeeIds) => { calls.countPendingCorrections(employeeIds); return 3; },
        },
        payroll: {
            latestPeriodSnapshot: async () => {
                calls.latestPeriodSnapshot();
                return {
                    periodId: "period-1", name: "2026-08", stage: "approved", status: "processing",
                    payDate: new Date("2026-09-05T00:00:00.000Z"),
                    headcount: 4, gross: 80_000_000, net: 68_000_000, finalizedCount: 3,
                };
            },
            latestPayslipOf: async () => ({ periodName: "2026-08", status: "approved", netSalary: 17_000_000 }),
        },
        performance: {
            activeCycleProgress: async () => ({ cycleId: "cycle-1", cycleStatus: "active", lockedCount: 18, pendingCount: 2 }),
            countReviewsToScore: async () => 4,
            latestReviewStatusOf: async () => "acknowledged",
        },
        audit: {
            listRecent: async () => [{
                id: "audit-1", actorUserId: "user-1", resource: "payroll_variance", action: "sign",
                resourceId: "variance-1", occurredAt: new Date("2026-08-06T02:00:00.000Z"),
            }],
        },
    };

    return { sources, calls };
}

describe("GetDashboardOverviewUseCase — phạm vi all (HR/Admin)", () => {
    it("trả KPI toàn công ty và KHÔNG giới hạn tập nhân viên", async () => {
        const { sources, calls } = buildSources({ scope: "all", permissions: ["payroll:prepare", "audit:read"] });

        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-hr" });

        expect(overview.scope).toBe("all");
        expect(overview.timezone).toBe(TZ);
        expect(overview.headcount).toMatchObject({ total: 3, active: 2 });
        // `undefined` = không giới hạn -> chỉ hợp lệ với phạm vi `all`.
        expect(calls.countByDay).toHaveBeenCalledWith(expect.anything(), undefined);
        expect(calls.listSummariesByIds).not.toHaveBeenCalled();
    });

    it("đếm nhân sự theo phòng ban chỉ tính người active, kèm tên phòng ban", async () => {
        const { sources } = buildSources({ scope: "all" });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-hr" });

        expect(overview.headcount?.byDepartment).toEqual([{ departmentId: "dept-1", name: "Engineering", count: 2 }]);
    });

    it("có quyền payroll -> thấy tổng lương; ngày chi đổi sang ngày công ty", async () => {
        const { sources } = buildSources({ scope: "all", permissions: ["payroll:approve"] });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-admin" });

        expect(overview.payroll).toMatchObject({
            name: "2026-08", stage: "approved", payDate: "2026-09-05",
            totals: { gross: 80_000_000, net: 68_000_000, finalizedCount: 3 },
        });
    });

    it("KHÔNG có quyền payroll -> `payroll` là null, KHÔNG phải số 0", async () => {
        const { sources, calls } = buildSources({ scope: "all", permissions: [] });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-x" });

        expect(overview.payroll).toBeNull();
        // Không có quyền thì thậm chí KHÔNG truy vấn tổng lương.
        expect(calls.latestPeriodSnapshot).not.toHaveBeenCalled();
    });

    it("có audit:read -> có nhật ký; thiếu quyền -> null (khác mảng rỗng)", async () => {
        const withAudit = buildSources({ scope: "all", permissions: ["audit:read"] });
        const withoutAudit = buildSources({ scope: "all", permissions: [] });

        const allowed = await new GetDashboardOverviewUseCase(withAudit.sources).execute({ actorUserId: "user-hr" });
        const denied  = await new GetDashboardOverviewUseCase(withoutAudit.sources).execute({ actorUserId: "user-manager" });

        expect(allowed.auditActivity).toHaveLength(1);
        expect(denied.auditActivity).toBeNull();
    });

    it("tiến độ chu kỳ đánh giá; KHÔNG có bảng xếp hạng nào", async () => {
        const { sources } = buildSources({ scope: "all" });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-hr" });

        expect(overview.performance).toEqual({ cycleId: "cycle-1", cycleStatus: "active", lockedCount: 18, pendingCount: 2 });
        expect(JSON.stringify(overview)).not.toContain("performers");
        expect(JSON.stringify(overview)).not.toContain("leaderboard");
    });
});

describe("GetDashboardOverviewUseCase — phạm vi team (Manager)", () => {
    it("mọi truy vấn bị giới hạn ĐÚNG tập cấp dưới", async () => {
        const { sources, calls } = buildSources({
            scope: "team", ownEmployeeId: "emp-2", teamIds: ["emp-2", "emp-1"],
            permissions: ["payroll:prepare", "audit:read"],
        });

        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-manager" });

        expect(overview.scope).toBe("team");
        for (const call of [calls.countByDay.mock.calls[0]?.[1], calls.listPending.mock.calls[0]?.[0]]) {
            expect(call).toEqual(["emp-2", "emp-1"]);
        }
        expect(calls.listSummaries).not.toHaveBeenCalled();
        // Người ngoài phạm vi không xuất hiện ở bất kỳ đâu trong payload.
        expect(JSON.stringify(overview)).not.toContain("emp-3");
        expect(JSON.stringify(overview)).not.toContain("Le Van C");
    });

    it("KHÔNG bao giờ nhận tổng lương công ty, dù có quyền payroll", async () => {
        const { sources, calls } = buildSources({
            scope: "team", ownEmployeeId: "emp-2", teamIds: ["emp-2"], permissions: ["payroll:prepare"],
        });

        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-manager" });

        expect(overview.payroll).toBeNull();
        expect(calls.latestPeriodSnapshot).not.toHaveBeenCalled();
        // Nhưng phiếu của CHÍNH manager thì được xem.
        expect(overview.myPayslip).toMatchObject({ netSalary: 17_000_000 });
    });

    it("phần đánh giá chỉ là SỐ phiếu phải chấm, không có điểm của ai", async () => {
        const { sources } = buildSources({ scope: "team", ownEmployeeId: "emp-2", teamIds: ["emp-2"] });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-manager" });

        expect(overview.performance).toEqual({ reviewsToScore: 4 });
    });

    it("hàng chờ duyệt KHÔNG chứa lý do nghỉ phép", async () => {
        const { sources } = buildSources({ scope: "team", ownEmployeeId: "emp-2", teamIds: ["emp-2", "emp-1"] });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-manager" });

        expect(overview.pendingApprovals).toMatchObject({ leaveRequests: 1, correctionRequests: 3 });
        expect(overview.pendingApprovals?.leaveItems[0]).toEqual({
            id: "leave-1", employeeId: "emp-1", employeeCode: "EMP-001", employeeName: "Nguyen Van A",
            leaveType: "annual", startDate: "2026-08-10", endDate: "2026-08-11", days: 2,
            submittedAt: new Date("2026-08-05T03:00:00.000Z"),
        });
        expect(JSON.stringify(overview)).not.toContain("reason");
    });
});

describe("GetDashboardOverviewUseCase — phạm vi self (Employee)", () => {
    it("chỉ dữ liệu của chính mình; headcount và hàng chờ duyệt là null", async () => {
        const { sources, calls } = buildSources({ scope: "self", ownEmployeeId: "emp-1" });

        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-emp" });

        expect(overview.scope).toBe("self");
        expect(overview.headcount).toBeNull();
        expect(overview.pendingApprovals).toBeNull();
        expect(overview.payroll).toBeNull();
        expect(calls.countByDay).toHaveBeenCalledWith(expect.anything(), ["emp-1"]);
        expect(overview.myPayslip).toMatchObject({ periodName: "2026-08" });
        expect(overview.performance).toEqual({ myReviewStatus: "acknowledged" });
    });

    it("tài khoản KHÔNG gắn nhân viên nào: rỗng hết, không mở toàn bộ dữ liệu", async () => {
        const { sources, calls } = buildSources({ scope: "self", ownEmployeeId: undefined });

        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-orphan" });

        expect(calls.listSummaries).not.toHaveBeenCalled();
        expect(calls.countByDay).not.toHaveBeenCalled();
        expect(overview.attendanceToday.present).toBe(0);
        expect(overview.attendanceTrend.last7Days).toHaveLength(7);
        expect(overview.upcomingLeaves).toEqual([]);
        expect(overview.myPayslip).toBeNull();
        expect(overview.performance).toBeNull();
    });
});

describe("GetDashboardOverviewUseCase — timezone và dữ liệu trống", () => {
    beforeEach(() => vi.useRealTimers());

    it("chuỗi xu hướng dài đúng 7 và 30 ngày, không khuyết ngày", async () => {
        const { sources } = buildSources({ scope: "all" });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-hr" });

        expect(overview.attendanceTrend.last7Days).toHaveLength(7);
        expect(overview.attendanceTrend.last30Days).toHaveLength(30);
        for (const day of overview.attendanceTrend.last30Days) {
            expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });

    it('"hôm nay" cắt theo timezone CÔNG TY, không theo giờ máy chủ', async () => {
        // 2026-08-06T18:30Z = 01:30 ngày 07/08 giờ VN -> ngày công ty phải là 07.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-06T18:30:00.000Z"));

        const { sources } = buildSources({ scope: "all" });
        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-hr" });

        expect(overview.attendanceToday.date).toBe("2026-08-07");
        vi.useRealTimers();
    });

    it("không có bản ghi chấm công: mọi ô là 0 và 'chưa chấm' = số người active", async () => {
        const { sources } = buildSources({ scope: "all" });
        sources.attendance.countByDay = async () => [];

        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-hr" });

        expect(overview.attendanceToday).toMatchObject({ present: 0, late: 0, notRecorded: 2 });
    });

    it("chưa có kỳ lương: payroll null dù có quyền", async () => {
        const { sources } = buildSources({ scope: "all", permissions: ["payroll:prepare"] });
        sources.payroll.latestPeriodSnapshot = async () => undefined;

        const overview = await new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-hr" });
        expect(overview.payroll).toBeNull();
    });

    it("không có khoá dashboard:read nào -> AccessDeniedError", async () => {
        const { sources } = buildSources({ scope: "all" });
        sources.permissions.resolveScope = async () => { throw new AccessDeniedError(); };

        await expect(new GetDashboardOverviewUseCase(sources).execute({ actorUserId: "user-x" }))
            .rejects.toThrow(AccessDeniedError);
    });
});
