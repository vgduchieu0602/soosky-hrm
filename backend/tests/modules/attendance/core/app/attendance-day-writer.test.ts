import AttendancePeriodLockDirectory from "@modules/attendance/core/app/ports/AttendancePeriodLockDirectory";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import CompanyCalendarDirectory from "@modules/attendance/core/app/ports/CompanyCalendarDirectory";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import AttendanceDayWriter from "@modules/attendance/core/app/services/AttendanceDayWriter";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import Holiday from "@modules/attendance/core/domain/entities/Holiday";
import HolidayName from "@modules/attendance/core/domain/value-objects/HolidayName";
import Shift from "@modules/attendance/core/domain/entities/Shift";
import ShiftCode from "@modules/attendance/core/domain/value-objects/ShiftCode";
import ShiftName from "@modules/attendance/core/domain/value-objects/ShiftName";
import ShiftTimeWindow from "@modules/attendance/core/domain/value-objects/ShiftTimeWindow";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

/** Ca hành chính 08:00–17:00 (nghỉ trưa 60'), làm thứ 2–6. */
function officeShift(): Shift {
    return Shift.create({
        id:           "shift-1",
        code:         ShiftCode.create("HC"),
        name:         ShiftName.create("Hanh chinh"),
        window:       ShiftTimeWindow.create("08:00", "17:00", 60),
        workingDays:  [1, 2, 3, 4, 5],
    });
}

function holiday(dateIso: string): Holiday {
    return Holiday.create({
        id:          "hol-1",
        name:        HolidayName.create("Quoc khanh"),
        date:        new Date(dateIso),
        isRecurring: false,
    });
}

/** 2026-06-01 là thứ Hai. Giờ VN = UTC+7 nên 08:00 VN = 01:00 UTC. */
const MONDAY   = new Date("2026-06-01T03:00:00.000Z");
const IN_08_00 = new Date("2026-06-01T01:00:00.000Z");
const OUT_17_00 = new Date("2026-06-01T10:00:00.000Z");

describe("AttendanceDayWriter", () => {
    let attendanceRepo: MockProxy<AttendanceRepo>;
    let shiftRepo: MockProxy<ShiftRepo>;
    let holidayRepo: MockProxy<HolidayRepo>;
    let calendar: MockProxy<CompanyCalendarDirectory>;
    let periodLocks: MockProxy<AttendancePeriodLockDirectory>;
    let writer: AttendanceDayWriter;

    beforeEach(() => {
        attendanceRepo = mock<AttendanceRepo>();
        shiftRepo      = mock<ShiftRepo>();
        holidayRepo    = mock<HolidayRepo>();
        calendar       = mock<CompanyCalendarDirectory>();
        periodLocks    = mock<AttendancePeriodLockDirectory>();

        writer = new AttendanceDayWriter(attendanceRepo, shiftRepo, holidayRepo, calendar, periodLocks);

        calendar.timezone.mockResolvedValue("Asia/Ho_Chi_Minh");
        periodLocks.findLockedPeriodCovering.mockResolvedValue(undefined);
        holidayRepo.listOverlapping.mockResolvedValue([]);
        shiftRepo.listActive.mockResolvedValue([officeShift()]);
        attendanceRepo.getBySlot.mockResolvedValue(undefined);
    });

    it("đi làm đủ ca: 1.0 công, status present, không trễ không sớm", async () => {
        const result = await writer.write({
            employeeId: "emp-1", date: MONDAY, checkIn: IN_08_00, checkOut: OUT_17_00, source: "manual",
        });

        expect(result.totalCong).toBe(1);
        const record = result.records[0] as Attendance;
        expect(record.status.value).toBe("present");
        expect(record.lateMinutes).toBe(0);
        expect(record.earlyMinutes).toBe(0);
        expect(record.workHours).toBe(8);
    });

    it("dùng TIMEZONE doanh nghiệp, không dùng giờ máy chủ", async () => {
        // Cùng một cặp mốc UTC: đọc theo Asia/Ho_Chi_Minh là 08:00–17:00 (đúng
        // ca, đủ công); đọc theo UTC là 01:00–10:00, tức rời ca sớm 7 tiếng nên
        // MẤT công. Container chạy UTC, nên nếu code lấy giờ máy chủ thì mọi
        // ngày công của cả công ty biến thành `early_leave`.
        calendar.timezone.mockResolvedValue("UTC");

        const result = await writer.write({
            employeeId: "emp-1", date: MONDAY, checkIn: IN_08_00, checkOut: OUT_17_00, source: "manual",
        });

        expect(result.totalCong).toBe(0);
        expect((result.records[0] as Attendance).status.value).toBe("early_leave");
    });

    it("đi trễ: vẫn tính công, ghi số phút trễ", async () => {
        const late = new Date("2026-06-01T01:30:00.000Z");   // 08:30 VN

        const result = await writer.write({
            employeeId: "emp-1", date: MONDAY, checkIn: late, checkOut: OUT_17_00, source: "manual",
        });

        expect(result.totalCong).toBe(1);
        expect((result.records[0] as Attendance).status.value).toBe("late");
        expect((result.records[0] as Attendance).lateMinutes).toBe(30);
    });

    it("về sớm quá ngưỡng: MẤT công, status early_leave", async () => {
        const early = new Date("2026-06-01T06:00:00.000Z");   // 13:00 VN, sớm 240'

        const result = await writer.write({
            employeeId: "emp-1", date: MONDAY, checkIn: IN_08_00, checkOut: early, source: "manual",
        });

        expect(result.totalCong).toBe(0);
        expect((result.records[0] as Attendance).status.value).toBe("early_leave");
        expect((result.records[0] as Attendance).congWeight).toBe(0);
    });

    it("thiếu giờ ra: status incomplete, không tính công, KHÔNG phải absent", async () => {
        const result = await writer.write({
            employeeId: "emp-1", date: MONDAY, checkIn: IN_08_00, source: "manual",
        });

        const record = result.records[0] as Attendance;
        expect(record.status.value).toBe("incomplete");
        expect(record.congWeight).toBe(0);
        expect(result.totalCong).toBe(0);
    });

    it("ngày lễ: ghi bản ghi holiday trung tính, không đòi phải có ca", async () => {
        holidayRepo.listOverlapping.mockResolvedValue([holiday("2026-06-01T00:00:00.000Z")]);
        // Không có ca nào cấu hình — ngày lễ vẫn ghi được.
        shiftRepo.listActive.mockResolvedValue([]);

        const result = await writer.write({ employeeId: "emp-1", date: MONDAY, source: "manual" });

        expect(result.totalCong).toBe(0);
        const record = result.records[0] as Attendance;
        expect(record.status.value).toBe("holiday");
        expect(record.congWeight).toBe(0);
    });

    it("kỳ đã chốt chấm công: chặn mọi thao tác ghi", async () => {
        periodLocks.findLockedPeriodCovering.mockResolvedValue({ periodId: "p1", name: "2026-06" });

        await expect(writer.write({
            employeeId: "emp-1", date: MONDAY, checkIn: IN_08_00, checkOut: OUT_17_00, source: "manual",
        })).rejects.toMatchObject({ code: "ATTENDANCE_PERIOD_LOCKED" });

        expect(attendanceRepo.save).not.toHaveBeenCalled();
    });

    it("ngày không có ca áp dụng (cuối tuần): báo lỗi thay vì ghi bừa", async () => {
        const saturday = new Date("2026-06-06T03:00:00.000Z");

        await expect(writer.write({
            employeeId: "emp-1", date: saturday, checkIn: IN_08_00, checkOut: OUT_17_00, source: "manual",
        })).rejects.toMatchObject({ code: "NO_APPLICABLE_SHIFT" });
    });
});
