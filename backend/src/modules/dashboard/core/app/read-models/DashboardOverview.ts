import { PermissionScope } from "@shared/core/app/authorization/PermissionScope";

/**
 * Read model của trang tổng quan.
 *
 * `null` ở một nhánh nghĩa là ACTOR KHÔNG ĐƯỢC XEM hoặc không có nguồn dữ liệu;
 * `[]`/`0` nghĩa là được xem nhưng rỗng. Phân biệt hai thứ này là cố ý: frontend
 * phải hiện "không có quyền" khác với "chưa có dữ liệu", và không được suy ra số.
 */
export interface DashboardOverview {
    /** Mốc sinh dữ liệu (UTC). */
    generatedAt:      Date;
    /** Timezone CÔNG TY dùng để cắt ngày — không phải timezone máy chủ. */
    timezone:         string;
    scope:            PermissionScope;

    /** `null` với phạm vi `self`: một người không phải là "nhân sự công ty". */
    headcount:        HeadcountSummary | null;
    attendanceToday:  AttendanceDayCount;
    attendanceTrend:  { last7Days: AttendanceDayCount[]; last30Days: AttendanceDayCount[] };
    /** `null` khi actor không duyệt gì (phạm vi `self`). */
    pendingApprovals: PendingApprovals | null;
    /** Đơn ĐÃ DUYỆT bắt đầu từ hôm nay trở đi, trong phạm vi của actor. */
    upcomingLeaves:   LeaveQueueItem[];
    /** `null` khi thiếu quyền payroll hoặc chưa có kỳ lương nào. */
    payroll:          PayrollSnapshot | null;
    /** Phiếu lương của CHÍNH actor (mọi phạm vi). `null` khi chưa có. */
    myPayslip:        MyPayslipSummary | null;
    /** Hình dạng đổi theo phạm vi — xem `DashboardPerformance`. */
    performance:      DashboardPerformance | null;
    /** `null` khi actor KHÔNG có `audit:read`. */
    auditActivity:    AuditActivityItem[] | null;
}

export interface HeadcountSummary {
    total:             number;
    active:            number;
    newHiresThisMonth: number;
    byDepartment:      { departmentId: string; name: string; count: number }[];
}

/** Số ngày công theo trạng thái cho MỘT ngày (ngày theo timezone công ty). */
export interface AttendanceDayCount {
    /** `YYYY-MM-DD` theo timezone công ty. */
    date:        string;
    present:     number;
    late:        number;
    incomplete:  number;
    onLeave:     number;
    absent:      number;
    /** Nhân viên trong phạm vi mà ngày đó KHÔNG có bản ghi nào. */
    notRecorded: number;
}

export interface PendingApprovals {
    leaveRequests:      number;
    correctionRequests: number;
    /** Tối đa `PENDING_QUEUE_LIMIT` dòng — hàng chờ để bấm vào, không phải báo cáo. */
    leaveItems:         LeaveQueueItem[];
}

/**
 * Một dòng hàng chờ nghỉ phép.
 *
 * KHÔNG có `reason`: lý do nghỉ là dữ liệu riêng tư, người duyệt đọc trong trang
 * chi tiết đơn chứ không phải trên bảng điều khiển.
 */
export interface LeaveQueueItem {
    id:           string;
    employeeId:   string;
    employeeCode: string;
    employeeName: string;
    leaveType:    string;
    /** `YYYY-MM-DD` theo timezone công ty. */
    startDate:    string;
    endDate:      string;
    days:         number;
    submittedAt:  Date;
}

export interface PayrollSnapshot {
    periodId:  string;
    name:      string;
    /** Bước trong quy trình 7 bước. */
    stage:     string;
    status:    string;
    /** `YYYY-MM-DD` theo timezone công ty. */
    payDate:   string;
    headcount: number;
    totals:    { gross: number; net: number; finalizedCount: number };
}

export interface MyPayslipSummary {
    periodName: string;
    status:     string;
    netSalary:  number;
}

/**
 * Phần đánh giá, khác nhau theo phạm vi:
 *
 * - `all`  → tiến độ chu kỳ (đã khoá / còn lại);
 * - `team` → số phiếu actor phải chấm;
 * - `self` → trạng thái phiếu của chính actor.
 *
 * KHÔNG có bảng xếp hạng: xem điểm người khác cần một chính sách quyền riêng.
 */
export interface DashboardPerformance {
    cycleId?:        string;
    cycleStatus?:    string;
    lockedCount?:    number;
    pendingCount?:   number;
    reviewsToScore?: number;
    myReviewStatus?: string;
}

export interface AuditActivityItem {
    id:          string;
    actorUserId: string | null;
    resource:    string;
    action:      string;
    resourceId:  string | null;
    occurredAt:  Date;
}
