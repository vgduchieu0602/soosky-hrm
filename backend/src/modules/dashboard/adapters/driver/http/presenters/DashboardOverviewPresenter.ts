import {
    AttendanceDayCount,
    AuditActivityItem,
    DashboardOverview,
    LeaveQueueItem,
} from "@modules/dashboard/core/app/read-models/DashboardOverview";

export interface DashboardOverviewDTO {
    generatedAt:      string;
    timezone:         string;
    scope:            string;
    headcount:        DashboardOverview["headcount"];
    attendanceToday:  AttendanceDayCount;
    attendanceTrend:  { last7Days: AttendanceDayCount[]; last30Days: AttendanceDayCount[] };
    pendingApprovals: {
        leaveRequests:      number;
        correctionRequests: number;
        leaveItems:         LeaveQueueItemDTO[];
    } | null;
    upcomingLeaves:   LeaveQueueItemDTO[];
    payroll:          DashboardOverview["payroll"];
    myPayslip:        DashboardOverview["myPayslip"];
    performance:      DashboardOverview["performance"];
    auditActivity:    AuditActivityItemDTO[] | null;
}

export interface LeaveQueueItemDTO extends Omit<LeaveQueueItem, "submittedAt"> {
    submittedAt: string;
}

export interface AuditActivityItemDTO extends Omit<AuditActivityItem, "occurredAt"> {
    occurredAt: string;
}

/**
 * Read model → DTO. Chỉ đổi `Date` thành ISO; KHÔNG tính toán thêm và không bọc
 * envelope: `null` từ use-case (không được xem / không có nguồn) phải đi nguyên
 * ra client để frontend hiện đúng trạng thái.
 */
const DashboardOverviewPresenter = {
    toDTO(overview: DashboardOverview): DashboardOverviewDTO {
        return {
            generatedAt:      overview.generatedAt.toISOString(),
            timezone:         overview.timezone,
            scope:            overview.scope,
            headcount:        overview.headcount,
            attendanceToday:  overview.attendanceToday,
            attendanceTrend:  overview.attendanceTrend,
            pendingApprovals: overview.pendingApprovals == null ? null : {
                leaveRequests:      overview.pendingApprovals.leaveRequests,
                correctionRequests: overview.pendingApprovals.correctionRequests,
                leaveItems:         overview.pendingApprovals.leaveItems.map(toLeaveDTO),
            },
            upcomingLeaves:   overview.upcomingLeaves.map(toLeaveDTO),
            payroll:          overview.payroll,
            myPayslip:        overview.myPayslip,
            performance:      overview.performance,
            auditActivity:    overview.auditActivity == null
                ? null
                : overview.auditActivity.map(entry => ({ ...entry, occurredAt: entry.occurredAt.toISOString() })),
        };
    },
};

function toLeaveDTO(item: LeaveQueueItem): LeaveQueueItemDTO {
    return { ...item, submittedAt: item.submittedAt.toISOString() };
}

export default DashboardOverviewPresenter;
