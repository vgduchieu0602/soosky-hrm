import { DashboardHttpUseCases } from "@modules/dashboard/adapters/driver/http";
import GetDashboardOverviewUseCase from "@modules/dashboard/core/app/use-cases/GetDashboardOverviewUseCase";
import { createAttendanceReportDirectory } from "@modules/attendance";
import { createDepartmentNameDirectory } from "@modules/department";
import { createEmployeeDirectory, createEmployeeSummaryDirectory } from "@modules/employee";
import { createIamAccessControl, createIamAuditReader } from "@modules/iam";
import { createPayrollReportDirectory } from "@modules/payroll";
import { createPerformanceReportDirectory } from "@modules/performance";
import { createCompanyCalendar } from "@modules/setting";
import { Db as MongoDb } from "mongodb";

const WILDCARD_PERMISSION_KEY = "*";

/**
 * Lắp use-case của module Dashboard — composition root NỐI DÂY sáu module nghiệp
 * vụ vào các port cục bộ của Dashboard.
 *
 * Đây là chỗ DUY NHẤT biết cả hai bên: `core` của Dashboard chỉ thấy interface
 * trong `DashboardSources`, nên module này mang sang host khác được mà không kéo
 * theo Employee/Attendance/Payroll/Performance/IAM.
 */
export default function createDashboardHttpUseCases(mongoDb: MongoDb): DashboardHttpUseCases {
    const iam = createIamAccessControl(mongoDb);
    const employeeDirectory = createEmployeeDirectory(mongoDb);
    const employeeSummaries = createEmployeeSummaryDirectory(mongoDb);

    return {
        getDashboardOverview: new GetDashboardOverviewUseCase({
            permissions: {
                resolveScope: (actorUserId, permissionKey) => iam.resolveScope(actorUserId, permissionKey),
                // `hasPermission` không ném lỗi: dùng để QUYẾT ĐỊNH ẨN nhánh dữ liệu
                // (tổng lương, nhật ký), không phải để chặn request.
                hasPermission: async (actorUserId, permissionKey) => {
                    const effective = await iam.listPermissionsOf(actorUserId);
                    return effective.includes(permissionKey) || effective.includes(WILDCARD_PERMISSION_KEY);
                },
            },

            clock: createCompanyCalendar(mongoDb),

            employees: {
                listSummaries:          () => employeeSummaries.listAll(),
                listSummariesByIds:     (employeeIds) => employeeSummaries.listByIds(employeeIds),
                findEmployeeIdByUserId: (userId) => employeeDirectory.findEmployeeIdByUserId(userId),
                listTeamEmployeeIds:    (actorUserId) => employeeDirectory.listTeamEmployeeIds(actorUserId),
            },

            departments: createDepartmentNameDirectory(mongoDb),

            attendance: (() => {
                const reports = createAttendanceReportDirectory(mongoDb);
                return { countByDay: (range, employeeIds) => reports.countByDay(range, employeeIds) };
            })(),

            leaves: (() => {
                const reports = createAttendanceReportDirectory(mongoDb);
                return {
                    listPending:             (employeeIds) => reports.listPendingLeaves(employeeIds),
                    listUpcomingApproved:    (from, employeeIds) => reports.listUpcomingApprovedLeaves(from, employeeIds),
                    countPendingCorrections: (employeeIds) => reports.countPendingCorrections(employeeIds),
                };
            })(),

            payroll:     createPayrollReportDirectory(mongoDb),
            performance: createPerformanceReportDirectory(mongoDb),
            audit:       createIamAuditReader(mongoDb),
        }),
    };
}
