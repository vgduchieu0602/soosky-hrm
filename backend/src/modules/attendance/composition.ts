import { MongoAttendanceRepo, MongoShiftRepo } from "@modules/attendance/adapters/driven/persistence/mongodb";
import { Db as MongoDb } from "mongodb";

/** Tổng hợp ngày công của một nhân viên trong một khoảng — dùng bởi module Payroll. */
export interface WorkdaySummary {
    /** Ngày làm được tính công (present/late/early_leave) + nghỉ phép có lương. */
    actualWorkDays: number;
    /** Nghỉ không lương + vắng mặt. */
    unpaidDays:     number;
}

/**
 * Cổng tra cứu sự tồn tại của ca làm việc + tổng hợp ngày công mà module khác
 * được phép tiêu thụ, KHÔNG cần import trực tiếp repo Mongo nội bộ của
 * Attendance.
 */
export interface AttendanceDirectory {
    shiftExists(shiftId: string): Promise<boolean>;
    /** Tổng hợp ngày công trong khoảng [from, to] — dùng bởi Payroll khi tính lương. */
    getWorkdaySummary(employeeId: string, range: { from: Date; to: Date }): Promise<WorkdaySummary>;
}

const PAID_WORK_STATUSES = new Set(["present", "late", "early_leave", "leave_paid"]);
const UNPAID_STATUSES    = new Set(["leave_unpaid", "absent"]);

/**
 * Lắp `AttendanceDirectory` trên nền MongoDB — điểm nối duy nhất để module
 * khác dùng dữ liệu tồn tại của Attendance mà vẫn giữ ranh giới module.
 */
export function createAttendanceDirectory(mongoDb: MongoDb): AttendanceDirectory {
    const shiftRepo = new MongoShiftRepo(mongoDb);
    const attendanceRepo = new MongoAttendanceRepo(mongoDb);

    return {
        shiftExists: async (shiftId: string) => (await shiftRepo.getById(shiftId)) != undefined,

        getWorkdaySummary: async (employeeId: string, range: { from: Date; to: Date }) => {
            const records = await attendanceRepo.listByEmployeeAndRange(employeeId, range.from, range.to);
            let actualWorkDays = 0;
            let unpaidDays = 0;
            for (const record of records) {
                const status = record.status.toString();
                if (PAID_WORK_STATUSES.has(status)) actualWorkDays += record.congWeight;
                else if (UNPAID_STATUSES.has(status)) unpaidDays += record.congWeight;
                // holiday/incomplete: trung tính, không vào tử số lẫn mẫu số (PAYROLL-FORMULA.md §2).
            }
            return { actualWorkDays, unpaidDays };
        },
    };
}
