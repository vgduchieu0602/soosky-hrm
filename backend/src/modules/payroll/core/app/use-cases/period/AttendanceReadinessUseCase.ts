import PayrollPeriodNotFoundError from "@modules/payroll/core/app/errors/PayrollPeriodNotFoundError";
import AttendanceDirectory from "@modules/payroll/core/app/ports/AttendanceDirectory";
import EmployeeDirectory from "@modules/payroll/core/app/ports/EmployeeDirectory";
import PayrollPeriodRepo from "@modules/payroll/core/app/ports/PayrollPeriodRepo";

export interface AttendanceReadinessOutput {
    attendanceLocked:      boolean;
    totalActiveEmployees:  number;
    /** Nhân viên active chưa có bản ghi chấm công/nghỉ nào trong kỳ. */
    employeesNoRecords:    number;
}

/**
 * Kiểm tra trước khi chốt chấm công: còn nhân viên active nào chưa có ngày
 * công/nghỉ nào trong kỳ không. Giản lược so với bản cũ: không phát hiện
 * riêng bản ghi `incomplete` (thiếu check-out) vì cổng `AttendanceDirectory`
 * hiện chỉ trả tổng hợp ngày công (xem payroll-report.md).
 */
export default class AttendanceReadinessUseCase {
    public constructor(
        private readonly _periods: PayrollPeriodRepo,
        private readonly _employees: EmployeeDirectory,
        private readonly _attendance: AttendanceDirectory,
    ) {}

    public async execute(input: { periodId: string }): Promise<AttendanceReadinessOutput> {
        const period = await this._periods.getById(input.periodId);
        if (period == undefined) throw new PayrollPeriodNotFoundError();

        const employeeIds = await this._employees.listActiveEmployeeIds();
        let employeesNoRecords = 0;
        for (const employeeId of employeeIds) {
            const summary = await this._attendance.getWorkdaySummary(employeeId, { from: period.startDate, to: period.endDate });
            if (summary.actualWorkDays + summary.unpaidDays === 0) employeesNoRecords += 1;
        }

        return {
            attendanceLocked: period.attendanceLockedAt != null,
            totalActiveEmployees: employeeIds.length,
            employeesNoRecords,
        };
    }
}
