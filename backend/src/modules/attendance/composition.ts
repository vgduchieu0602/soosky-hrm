import { MongoAttendanceCorrectionRequestRepo, MongoAttendanceRepo, MongoLeaveRequestRepo, MongoShiftRepo } from "@modules/attendance/adapters/driven/persistence/mongodb";
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

/** Số bản ghi chấm công theo trạng thái, gom theo ngày. */
export interface AttendanceDayStatusCount {
    date:          Date;
    present:       number;
    late:          number;
    incomplete:    number;
    onLeave:       number;
    absent:        number;
    /** Số nhân viên KHÁC NHAU có bản ghi trong ngày (suy ra "chưa chấm"). */
    employeeCount: number;
}

export interface PendingLeaveSummary {
    id:          string;
    employeeId:  string;
    leaveType:   string;
    startDate:   Date;
    endDate:     Date;
    days:        number;
    submittedAt: Date;
}

/**
 * Bề mặt tổng hợp chấm công / nghỉ phép / chỉnh công cho READ MODEL.
 *
 * Mọi hàm nhận `employeeIds` để caller thu hẹp theo phạm vi quyền; `undefined`
 * nghĩa là không giới hạn và CHỈ được truyền khi phạm vi actor là `all`. KHÔNG
 * hàm nào trả lý do nghỉ phép — đó là dữ liệu riêng tư, đọc ở trang chi tiết đơn.
 */
export interface AttendanceReportDirectory {
    countByDay(range: { from: Date; to: Date }, employeeIds?: readonly string[] | undefined): Promise<AttendanceDayStatusCount[]>;
    listPendingLeaves(employeeIds?: readonly string[] | undefined): Promise<PendingLeaveSummary[]>;
    listUpcomingApprovedLeaves(from: Date, employeeIds?: readonly string[] | undefined): Promise<PendingLeaveSummary[]>;
    countPendingCorrections(employeeIds?: readonly string[] | undefined): Promise<number>;
}

export function createAttendanceReportDirectory(mongoDb: MongoDb): AttendanceReportDirectory {
    const attendanceRepo = new MongoAttendanceRepo(mongoDb);
    const leaveRepo      = new MongoLeaveRequestRepo(mongoDb);
    const correctionRepo = new MongoAttendanceCorrectionRequestRepo(mongoDb);

    const STATUS_BUCKET: Record<string, keyof Omit<AttendanceDayStatusCount, "date" | "employeeCount">> = {
        present:      "present",
        late:         "late",
        early_leave:  "present",
        incomplete:   "incomplete",
        leave_paid:   "onLeave",
        leave_unpaid: "onLeave",
        absent:       "absent",
        // `holiday` cố ý không vào ô nào: ngày lễ không phải "đi làm" cũng không phải "vắng".
    };

    const toLeaveSummary = (leave: {
        id: string; employeeId: string; leaveType: { value: string } | string;
        startDate: Date; endDate: Date; days: number; createdAt: Date;
    }): PendingLeaveSummary => ({
        id:          leave.id,
        employeeId:  leave.employeeId,
        leaveType:   typeof leave.leaveType === "string" ? leave.leaveType : leave.leaveType.value,
        startDate:   leave.startDate,
        endDate:     leave.endDate,
        days:        leave.days,
        submittedAt: leave.createdAt,
    });

    return {
        countByDay: async (range, employeeIds) => {
            if (employeeIds != undefined && employeeIds.length === 0) return [];

            const rows = await attendanceRepo.countByStatusPerDay(range.from, range.to, employeeIds);

            const byDay = new Map<number, AttendanceDayStatusCount & { seen: Set<string> }>();
            for (const row of rows) {
                const key = row.date.getTime();
                const bucket = byDay.get(key) ?? {
                    date: row.date, present: 0, late: 0, incomplete: 0, onLeave: 0, absent: 0,
                    employeeCount: 0, seen: new Set<string>(),
                };

                const field = STATUS_BUCKET[row.status];
                if (field != undefined) bucket[field] += row.count;
                for (const employeeId of row.employeeIds) bucket.seen.add(employeeId);

                byDay.set(key, bucket);
            }

            return [...byDay.values()]
                .map(({ seen, ...bucket }) => ({ ...bucket, employeeCount: seen.size }))
                .sort((left, right) => left.date.getTime() - right.date.getTime());
        },

        listPendingLeaves: async (employeeIds) => {
            if (employeeIds != undefined && employeeIds.length === 0) return [];
            const leaves = await leaveRepo.list({ status: "pending", employeeIds });
            return leaves.map(toLeaveSummary);
        },

        listUpcomingApprovedLeaves: async (from, employeeIds) => {
            if (employeeIds != undefined && employeeIds.length === 0) return [];
            const leaves = await leaveRepo.list({ status: "approved", employeeIds, startFrom: from });
            return leaves.map(toLeaveSummary);
        },

        countPendingCorrections: async (employeeIds) => {
            if (employeeIds != undefined && employeeIds.length === 0) return 0;
            const requests = await correctionRepo.list({ status: "pending", ...(employeeIds == undefined ? {} : { employeeIds }) });
            return requests.length;
        },
    };
}
