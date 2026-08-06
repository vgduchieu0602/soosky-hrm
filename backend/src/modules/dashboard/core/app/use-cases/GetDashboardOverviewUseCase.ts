import {
    DashboardEmployeeSummary,
    DashboardSources,
    PendingLeaveRow,
} from "@modules/dashboard/core/app/ports/DashboardSources";
import {
    AttendanceDayCount,
    DashboardOverview,
    DashboardPerformance,
    HeadcountSummary,
    LeaveQueueItem,
    PendingApprovals,
} from "@modules/dashboard/core/app/read-models/DashboardOverview";
import { companyDayKey, lastCompanyDays } from "@modules/dashboard/core/app/services/company-day";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";

/** Khoá gốc quyền xem bảng điều khiển; có bản thu hẹp `:team` / `:self`. */
export const DASHBOARD_READ_PERMISSION_KEY = "dashboard:read";

/** Quyền nào cũng đủ để thấy tổng hợp lương — cả người lập và người duyệt đều cần. */
const PAYROLL_PERMISSION_KEYS = ["payroll:prepare", "payroll:approve"];
const AUDIT_PERMISSION_KEY = "audit:read";

const TREND_SHORT_DAYS = 7;
const TREND_LONG_DAYS  = 30;
/** Hàng chờ là chỗ để bấm vào, không phải báo cáo — cắt ngắn có chủ đích. */
const PENDING_QUEUE_LIMIT = 8;

export interface GetDashboardOverviewInput {
    actorUserId: string;
}

/**
 * Dựng read model của trang tổng quan.
 *
 * BACKEND quyết định actor thấy gì. Trước đây frontend tự ghép bảy endpoint, nên
 * "actor này được thấy gì" nằm rải rác ở phạm vi của từng endpoint và không ai
 * kiểm được tổng thể. Ở đây phạm vi được phân giải MỘT LẦN rồi mọi truy vấn đều
 * bị giới hạn theo nó.
 *
 * Quy ước `null` vs rỗng: `null` = không được xem / không có nguồn; `[]`/`0` =
 * được xem nhưng rỗng. Không bao giờ trả số suy diễn.
 *
 * @throws {AccessDeniedError} Actor không có khoá `dashboard:read` (mọi biến thể).
 */
export default class GetDashboardOverviewUseCase {
    public constructor(
        private readonly _sources: DashboardSources,
    ) {}

    public async execute(input: GetDashboardOverviewInput): Promise<DashboardOverview> {
        const { permissions, clock, employees } = this._sources;

        // `resolveScope` ném AccessDeniedError khi không có khoá nào -> không cần
        // kiểm hai lần; đây là cổng duy nhất vào read model.
        const scope = await permissions.resolveScope(input.actorUserId, DASHBOARD_READ_PERMISSION_KEY);

        const timezone = await clock.timezone();
        const now = new Date();

        const ownEmployeeId = await employees.findEmployeeIdByUserId(input.actorUserId);
        const visibleEmployeeIds = await this._resolveVisibleEmployeeIds(scope, input.actorUserId, ownEmployeeId);

        // Phạm vi `team`/`self` mà tài khoản không gắn nhân viên nào -> không thấy
        // ai. Cố ý trả rỗng thay vì mở toàn bộ vì thiếu liên kết.
        const summaries = visibleEmployeeIds == undefined
            ? await employees.listSummaries()
            : await employees.listSummariesByIds(visibleEmployeeIds);

        const [attendanceToday, trendShort, trendLong] = await Promise.all([
            this._attendanceForDays(now, timezone, 1, summaries, visibleEmployeeIds),
            this._attendanceForDays(now, timezone, TREND_SHORT_DAYS, summaries, visibleEmployeeIds),
            this._attendanceForDays(now, timezone, TREND_LONG_DAYS, summaries, visibleEmployeeIds),
        ]);

        const todayKey = companyDayKey(now, timezone);

        return {
            generatedAt:      now,
            timezone,
            scope,
            headcount:        scope === "self" ? null : this._headcount(summaries, await this._departmentNames(scope), todayKey),
            attendanceToday:  attendanceToday[0] ?? emptyDay(todayKey),
            attendanceTrend:  { last7Days: trendShort, last30Days: trendLong },
            pendingApprovals: await this._pendingApprovals(scope, timezone, summaries, visibleEmployeeIds),
            upcomingLeaves:   await this._upcomingLeaves(now, timezone, summaries, visibleEmployeeIds),
            payroll:          await this._payroll(input.actorUserId, scope, timezone),
            myPayslip:        await this._myPayslip(ownEmployeeId),
            performance:      await this._performance(scope, input.actorUserId, ownEmployeeId),
            auditActivity:    await this._auditActivity(input.actorUserId),
        };
    }

    /** `undefined` = không giới hạn (phạm vi `all`); mảng = đúng tập được xem. */
    private async _resolveVisibleEmployeeIds(
        scope: PermissionScope,
        actorUserId: string,
        ownEmployeeId: string | undefined,
    ): Promise<string[] | undefined> {
        if (scope === "all") return undefined;
        if (scope === "team") return this._sources.employees.listTeamEmployeeIds(actorUserId);
        return ownEmployeeId == undefined ? [] : [ownEmployeeId];
    }

    private async _departmentNames(scope: PermissionScope): Promise<Map<string, string>> {
        if (scope === "self") return new Map();
        const rows = await this._sources.departments.listNames();
        return new Map(rows.map(row => [row.id, row.name]));
    }

    private _headcount(
        summaries: DashboardEmployeeSummary[],
        departmentNames: Map<string, string>,
        todayKey: string,
    ): HeadcountSummary {
        const active = summaries.filter(employee => employee.status === "active");
        const monthPrefix = todayKey.slice(0, 7);

        const countByDepartment = new Map<string, number>();
        for (const employee of active) {
            countByDepartment.set(employee.departmentId, (countByDepartment.get(employee.departmentId) ?? 0) + 1);
        }

        return {
            total:  summaries.length,
            active: active.length,
            // So theo NGÀY địa phương của ngày vào làm, không so mốc UTC.
            newHiresThisMonth: summaries.filter(employee => employee.hireDate.toISOString().slice(0, 7) === monthPrefix).length,
            byDepartment: [...countByDepartment.entries()]
                .map(([departmentId, count]) => ({
                    departmentId,
                    name: departmentNames.get(departmentId) ?? departmentId,
                    count,
                }))
                .sort((left, right) => right.count - left.count),
        };
    }

    /**
     * Số ngày công theo trạng thái cho `dayCount` ngày gần nhất.
     *
     * "Chưa chấm" tính bằng số nhân viên ACTIVE trong phạm vi trừ số người có bản
     * ghi — không suy từ tổng nhân viên, vì người đã nghỉ việc không phải là
     * người "chưa chấm công".
     */
    private async _attendanceForDays(
        now: Date,
        timezone: string,
        dayCount: number,
        summaries: DashboardEmployeeSummary[],
        visibleEmployeeIds: string[] | undefined,
    ): Promise<AttendanceDayCount[]> {
        if (visibleEmployeeIds != undefined && visibleEmployeeIds.length === 0) {
            return lastCompanyDays(now, timezone, dayCount).dayKeys.map(emptyDay);
        }

        const { dayKeys, range } = lastCompanyDays(now, timezone, dayCount);
        const rows = await this._sources.attendance.countByDay(range, visibleEmployeeIds);

        const byDay = new Map(rows.map(row => [companyDayKey(row.date, timezone), row]));
        const activeCount = summaries.filter(employee => employee.status === "active").length;

        return dayKeys.map((dayKey) => {
            const row = byDay.get(dayKey);
            if (row == undefined) return { ...emptyDay(dayKey), notRecorded: activeCount };

            return {
                date:        dayKey,
                present:     row.present,
                late:        row.late,
                incomplete:  row.incomplete,
                onLeave:     row.onLeave,
                absent:      row.absent,
                notRecorded: Math.max(0, activeCount - row.employeeCount),
            };
        });
    }

    /** `null` với phạm vi `self`: nhân viên không duyệt đơn của ai. */
    private async _pendingApprovals(
        scope: PermissionScope,
        timezone: string,
        summaries: DashboardEmployeeSummary[],
        visibleEmployeeIds: string[] | undefined,
    ): Promise<PendingApprovals | null> {
        if (scope === "self") return null;
        if (visibleEmployeeIds != undefined && visibleEmployeeIds.length === 0) {
            return { leaveRequests: 0, correctionRequests: 0, leaveItems: [] };
        }

        const [pendingLeaves, correctionRequests] = await Promise.all([
            this._sources.leaves.listPending(visibleEmployeeIds),
            this._sources.leaves.countPendingCorrections(visibleEmployeeIds),
        ]);

        return {
            leaveRequests: pendingLeaves.length,
            correctionRequests,
            leaveItems: pendingLeaves
                .slice(0, PENDING_QUEUE_LIMIT)
                .map(row => toQueueItem(row, summaries, timezone)),
        };
    }

    private async _upcomingLeaves(
        now: Date,
        timezone: string,
        summaries: DashboardEmployeeSummary[],
        visibleEmployeeIds: string[] | undefined,
    ): Promise<LeaveQueueItem[]> {
        if (visibleEmployeeIds != undefined && visibleEmployeeIds.length === 0) return [];

        const { range } = lastCompanyDays(now, timezone, 1);
        const rows = await this._sources.leaves.listUpcomingApproved(range.from, visibleEmployeeIds);

        return rows
            .slice(0, PENDING_QUEUE_LIMIT)
            .map(row => toQueueItem(row, summaries, timezone));
    }

    /**
     * `null` khi actor không có quyền payroll nào: tổng lương công ty là dữ liệu
     * nhạy cảm, manager và nhân viên không được thấy.
     */
    private async _payroll(
        actorUserId: string,
        scope: PermissionScope,
        timezone: string,
    ): Promise<DashboardOverview["payroll"]> {
        if (scope !== "all") return null;

        const allowed = await Promise.all(
            PAYROLL_PERMISSION_KEYS.map(key => this._sources.permissions.hasPermission(actorUserId, key)),
        );
        if (!allowed.some(Boolean)) return null;

        const snapshot = await this._sources.payroll.latestPeriodSnapshot();
        if (snapshot == undefined) return null;

        return {
            periodId:  snapshot.periodId,
            name:      snapshot.name,
            stage:     snapshot.stage,
            status:    snapshot.status,
            payDate:   companyDayKey(snapshot.payDate, timezone),
            headcount: snapshot.headcount,
            totals:    { gross: snapshot.gross, net: snapshot.net, finalizedCount: snapshot.finalizedCount },
        };
    }

    private async _myPayslip(ownEmployeeId: string | undefined): Promise<DashboardOverview["myPayslip"]> {
        if (ownEmployeeId == undefined) return null;
        return (await this._sources.payroll.latestPayslipOf(ownEmployeeId)) ?? null;
    }

    /**
     * Ba hình dạng khác nhau theo phạm vi — xem `DashboardPerformance`. Không có
     * bảng xếp hạng ở bất kỳ phạm vi nào.
     */
    private async _performance(
        scope: PermissionScope,
        actorUserId: string,
        ownEmployeeId: string | undefined,
    ): Promise<DashboardPerformance | null> {
        if (scope === "all") {
            const progress = await this._sources.performance.activeCycleProgress();
            return progress == undefined ? null : { ...progress };
        }

        if (scope === "team") {
            return { reviewsToScore: await this._sources.performance.countReviewsToScore(actorUserId) };
        }

        if (ownEmployeeId == undefined) return null;
        const status = await this._sources.performance.latestReviewStatusOf(ownEmployeeId);
        return status == undefined ? null : { myReviewStatus: status };
    }

    /** `null` khi thiếu `audit:read` — khác hẳn `[]` nghĩa là "được xem, chưa có gì". */
    private async _auditActivity(actorUserId: string): Promise<DashboardOverview["auditActivity"]> {
        if (!await this._sources.permissions.hasPermission(actorUserId, AUDIT_PERMISSION_KEY)) return null;
        return this._sources.audit.listRecent(PENDING_QUEUE_LIMIT);
    }
}

function emptyDay(dayKey: string): AttendanceDayCount {
    return { date: dayKey, present: 0, late: 0, incomplete: 0, onLeave: 0, absent: 0, notRecorded: 0 };
}

/**
 * Dòng hàng chờ: chỉ mã + tên nhân viên (cần để người duyệt nhận ra ai), KHÔNG có
 * lý do nghỉ hay bất kỳ PII nào khác.
 */
function toQueueItem(row: PendingLeaveRow, summaries: DashboardEmployeeSummary[], timezone: string): LeaveQueueItem {
    const employee = summaries.find(summary => summary.id === row.employeeId);

    return {
        id:           row.id,
        employeeId:   row.employeeId,
        employeeCode: employee?.code ?? "—",
        employeeName: employee?.name ?? "—",
        leaveType:    row.leaveType,
        startDate:    companyDayKey(row.startDate, timezone),
        endDate:      companyDayKey(row.endDate, timezone),
        days:         row.days,
        submittedAt:  row.submittedAt,
    };
}
