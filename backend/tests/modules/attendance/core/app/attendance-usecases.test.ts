import NoApplicableShiftError from "@modules/attendance/core/app/errors/NoApplicableShiftError";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import AttendancePeriodLockDirectory from "@modules/attendance/core/app/ports/AttendancePeriodLockDirectory";
import CompanyCalendarDirectory from "@modules/attendance/core/app/ports/CompanyCalendarDirectory";
import HolidayRepo from "@modules/attendance/core/app/ports/HolidayRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AttendanceDayWriter from "@modules/attendance/core/app/services/AttendanceDayWriter";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import UpsertAttendanceUseCase from "@modules/attendance/core/app/use-cases/attendance/UpsertAttendanceUseCase";
import Shift from "@modules/attendance/core/domain/entities/Shift";
import ShiftCode from "@modules/attendance/core/domain/value-objects/ShiftCode";
import ShiftName from "@modules/attendance/core/domain/value-objects/ShiftName";
import ShiftTimeWindow from "@modules/attendance/core/domain/value-objects/ShiftTimeWindow";
import AccessDeniedError from "@shared/core/app/errors/AccessDeniedError";
import { beforeEach, describe, expect, it } from "vitest";
import { mock, MockProxy } from "vitest-mock-extended";

function fullDayShift(): Shift {
    return Shift.create({
        id:          "shift-1",
        code:        ShiftCode.create("FULL"),
        name:        ShiftName.create("Full day"),
        window:      ShiftTimeWindow.create("08:00", "17:00", 60),
        workingDays: [1, 2, 3, 4, 5],
    });
}

describe("UpsertAttendanceUseCase", () => {
    let permissions: MockProxy<PermissionChecker>;
    let attendanceRepo: MockProxy<AttendanceRepo>;
    let shiftRepo: MockProxy<ShiftRepo>;
    let employeeDirectory: MockProxy<EmployeeDirectory>;
    let useCase: UpsertAttendanceUseCase;

    beforeEach(() => {
        permissions       = mock<PermissionChecker>();
        attendanceRepo    = mock<AttendanceRepo>();
        shiftRepo         = mock<ShiftRepo>();
        employeeDirectory = mock<EmployeeDirectory>();
        // Kỳ công mở, timezone VN — hai cổng này có test riêng cho trường hợp khoá.
        const openPeriods: AttendancePeriodLockDirectory = { async findLockedPeriodCovering() { return undefined; } };
        const vnCalendar: CompanyCalendarDirectory = { async timezone() { return "Asia/Ho_Chi_Minh"; } };
        const holidayRepo = mock<HolidayRepo>();
        holidayRepo.listOverlapping.mockResolvedValue([]);

        const dayWriter = new AttendanceDayWriter(attendanceRepo, shiftRepo, holidayRepo, vnCalendar, openPeriods);
        useCase = new UpsertAttendanceUseCase(permissions, employeeDirectory, dayWriter);

        employeeDirectory.employeeExists.mockResolvedValue(true);
        shiftRepo.listActive.mockResolvedValue([fullDayShift()]);
        attendanceRepo.getBySlot.mockResolvedValue(undefined);
    });

    it("từ chối khi không có quyền attendance:manage", async () => {
        permissions.assertPermission.mockRejectedValue(new AccessDeniedError());

        // 2026-01-05 là Thứ Hai (VN)
        await expect(useCase.execute({
            employeeId:  "emp-1",
            date:        new Date(Date.UTC(2026, 0, 5)),
            checkIn:     new Date(Date.UTC(2026, 0, 5, 1)),
            checkOut:    new Date(Date.UTC(2026, 0, 5, 10)),
            actorUserId: "user-1",
        })).rejects.toBeInstanceOf(AccessDeniedError);

        expect(attendanceRepo.save).not.toHaveBeenCalled();
    });

    it("chặn khi không có ca nào áp dụng cho thứ trong tuần", async () => {
        permissions.assertPermission.mockResolvedValue(undefined);
        shiftRepo.listActive.mockResolvedValue([]);

        await expect(useCase.execute({
            employeeId:  "emp-1",
            date:        new Date(Date.UTC(2026, 0, 5)),
            actorUserId: "user-1",
        })).rejects.toBeInstanceOf(NoApplicableShiftError);
    });

    it("tính công và lưu bản ghi khi làm đủ ca", async () => {
        permissions.assertPermission.mockResolvedValue(undefined);

        const result = await useCase.execute({
            employeeId:  "emp-1",
            date:        new Date(Date.UTC(2026, 0, 5)),
            checkIn:     new Date(Date.UTC(2026, 0, 5, 1)),  // 08:00 VN
            checkOut:    new Date(Date.UTC(2026, 0, 5, 10)), // 17:00 VN
            actorUserId: "user-1",
        });

        expect(result.totalCong).toBe(1);
        expect(attendanceRepo.save).toHaveBeenCalledOnce();
    });
});
