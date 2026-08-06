import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";

/**
 * Toàn bộ cổng mà module Dashboard cần. Gom vào một file vì đây là module CHỈ ĐỌC:
 * mỗi cổng chỉ có một, hai hàm và luôn được nối cùng lúc ở composition root.
 *
 * Không cổng nào cho phép đọc dữ liệu ngoài phạm vi: mọi hàm theo nhân viên đều
 * nhận `employeeIds` đã được use-case thu hẹp trước, hoặc `undefined` nghĩa là
 * "không giới hạn" và chỉ dùng khi phạm vi actor là `all`.
 */

export interface DashboardPermissionChecker {
    /** Phạm vi actor trên một khoá gốc — `all` | `team` | `self`. */
    resolveScope(actorUserId: string, permissionKey: string): Promise<PermissionScope>;
    /** Có quyền cụ thể hay không, KHÔNG ném lỗi (dùng để quyết định ẩn nhánh dữ liệu). */
    hasPermission(actorUserId: string, permissionKey: string): Promise<boolean>;
}

/** Timezone công ty — mọi mốc "hôm nay" của bảng điều khiển cắt theo giá trị này. */
export interface DashboardCompanyClock {
    timezone(): Promise<string>;
}

export interface DashboardEmployeeSummary {
    id:           string;
    code:         string;
    name:         string;
    departmentId: string;
    hireDate:     Date;
    status:       string;
}

export interface DashboardEmployeeDirectory {
    /** Toàn bộ nhân viên (mọi trạng thái) — chỉ gọi khi phạm vi là `all`. */
    listSummaries(): Promise<DashboardEmployeeSummary[]>;
    /** Nhân viên theo id — dùng cho phạm vi `team`/`self`. */
    listSummariesByIds(employeeIds: readonly string[]): Promise<DashboardEmployeeSummary[]>;
    /** Nhân viên gắn với tài khoản đang đăng nhập. `undefined` = tài khoản quản trị thuần. */
    findEmployeeIdByUserId(userId: string): Promise<string | undefined>;
    /** Chính mình + toàn bộ cấp dưới mọi tầng. */
    listTeamEmployeeIds(actorUserId: string): Promise<string[]>;
}

export interface DashboardDepartmentDirectory {
    listNames(): Promise<{ id: string; name: string }[]>;
}

/** Số bản ghi chấm công theo trạng thái, đã gom theo NGÀY (UTC instant của mốc ngày). */
export interface AttendanceStatusCountByDay {
    date:       Date;
    present:    number;
    late:       number;
    incomplete: number;
    onLeave:    number;
    absent:     number;
    /** Số nhân viên KHÁC NHAU có bản ghi trong ngày — để suy ra "chưa chấm". */
    employeeCount: number;
}

export interface DashboardAttendanceDirectory {
    /**
     * Đếm bản ghi chấm công theo trạng thái, gom theo ngày, trong khoảng đã cho.
     * `employeeIds` bỏ trống = mọi nhân viên (chỉ dùng với phạm vi `all`).
     */
    countByDay(range: { from: Date; to: Date }, employeeIds?: readonly string[]): Promise<AttendanceStatusCountByDay[]>;
}

export interface PendingLeaveRow {
    id:          string;
    employeeId:  string;
    leaveType:   string;
    startDate:   Date;
    endDate:     Date;
    days:        number;
    submittedAt: Date;
}

export interface DashboardLeaveDirectory {
    /** Đơn `pending` trong phạm vi. `employeeIds` bỏ trống = mọi nhân viên. */
    listPending(employeeIds?: readonly string[]): Promise<PendingLeaveRow[]>;
    /** Đơn `approved` có ngày bắt đầu >= `from`, trong phạm vi. */
    listUpcomingApproved(from: Date, employeeIds?: readonly string[]): Promise<PendingLeaveRow[]>;
    /** Số yêu cầu chỉnh công còn `pending` trong phạm vi. */
    countPendingCorrections(employeeIds?: readonly string[]): Promise<number>;
}

export interface DashboardPayrollDirectory {
    /** Kỳ lương gần nhất + tổng hợp phiếu. `undefined` = chưa có kỳ nào. */
    latestPeriodSnapshot(): Promise<{
        periodId:       string;
        name:           string;
        stage:          string;
        status:         string;
        payDate:        Date;
        headcount:      number;
        gross:          number;
        net:            number;
        finalizedCount: number;
    } | undefined>;

    /** Phiếu lương gần nhất của MỘT nhân viên. `undefined` = chưa có. */
    latestPayslipOf(employeeId: string): Promise<{ periodName: string; status: string; netSalary: number } | undefined>;
}

export interface DashboardPerformanceDirectory {
    /** Tiến độ chu kỳ đánh giá đang mở. `undefined` = không có chu kỳ nào đang mở. */
    activeCycleProgress(): Promise<{ cycleId: string; cycleStatus: string; lockedCount: number; pendingCount: number } | undefined>;
    /** Số phiếu actor được phân công mà CHƯA chấm xong. */
    countReviewsToScore(reviewerUserId: string): Promise<number>;
    /** Trạng thái phiếu gần nhất của một nhân viên. `undefined` = chưa có phiếu. */
    latestReviewStatusOf(employeeId: string): Promise<string | undefined>;
}

export interface DashboardAuditDirectory {
    listRecent(limit: number): Promise<{
        id:          string;
        actorUserId: string | null;
        resource:    string;
        action:      string;
        resourceId:  string | null;
        occurredAt:  Date;
    }[]>;
}

/** Bộ cổng đầy đủ, nối một lần ở composition root. */
export interface DashboardSources {
    permissions:  DashboardPermissionChecker;
    clock:        DashboardCompanyClock;
    employees:    DashboardEmployeeDirectory;
    departments:  DashboardDepartmentDirectory;
    attendance:   DashboardAttendanceDirectory;
    leaves:       DashboardLeaveDirectory;
    payroll:      DashboardPayrollDirectory;
    performance:  DashboardPerformanceDirectory;
    audit:        DashboardAuditDirectory;
}
