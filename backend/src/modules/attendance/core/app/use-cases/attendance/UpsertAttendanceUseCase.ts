import EmployeeNotFoundError from "@modules/attendance/core/app/errors/EmployeeNotFoundError";
import NoApplicableShiftError from "@modules/attendance/core/app/errors/NoApplicableShiftError";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import ShiftRepo from "@modules/attendance/core/app/ports/ShiftRepo";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";
import { matchShifts, vnDateKey } from "@modules/attendance/core/domain/services/attendance-calc";
import AttendanceSession from "@modules/attendance/core/domain/value-objects/AttendanceSession";
import AttendanceStatus from "@modules/attendance/core/domain/value-objects/AttendanceStatus";
import { v7 as UUIDv7 } from "uuid";

const PERMISSION_KEY = "attendance:manage";

export interface UpsertAttendanceInput {
    employeeId:  string;
    date:        Date;
    checkIn?:    Date | null;
    checkOut?:   Date | null;
    note?:       string | null;
    actorUserId: string;
}

export interface UpsertAttendanceOutput {
    date:      Date;
    totalCong: number;
    records:   Attendance[];
}

/**
 * Nhập MỘT cặp check-in/check-out cho một ngày, tự động phân bổ (`matchShifts`)
 * cho các ca đang hoạt động áp dụng cho thứ trong tuần đó. Mỗi ca được tính
 * công có một bản ghi riêng; ca không được tính (không chồng lấn / về quá
 * sớm) sẽ xoá bản ghi thủ công cũ (nếu có, không đụng tới bản ghi nguồn
 * "leave"). Công trong ngày = tổng trọng số các ca được tính (port từ
 * `upsertDay` bản cũ).
 *
 * @throws {AccessDeniedError}      Actor không có quyền `attendance:manage`.
 * @throws {EmployeeNotFoundError}  Nhân viên không tồn tại.
 * @throws {NoApplicableShiftError} Không có ca nào áp dụng cho ngày trong tuần này.
 */
export default class UpsertAttendanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _attendanceRepo: AttendanceRepo,
        private readonly _shiftRepo: ShiftRepo,
        private readonly _employeeDirectory: EmployeeDirectory,
    ) {}

    public async execute(input: UpsertAttendanceInput): Promise<UpsertAttendanceOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const exists = await this._employeeDirectory.employeeExists(input.employeeId);
        if (!exists) throw new EmployeeNotFoundError();

        const dateKey = vnDateKey(input.date);
        const isoWeekday = dateKey.getUTCDay() === 0 ? 7 : dateKey.getUTCDay();

        const activeShifts = await this._shiftRepo.listActive();
        const applicable = activeShifts.filter(shift => shift.appliesToWeekday(isoWeekday));
        if (applicable.length === 0) throw new NoApplicableShiftError();

        const result = matchShifts(
            applicable.map(shift => ({
                id:           shift.id,
                startTime:    shift.window.startTime,
                endTime:      shift.window.endTime,
                breakMinutes: shift.window.breakMinutes,
            })),
            input.checkIn,
            input.checkOut,
        );

        const records: Attendance[] = [];
        for (const matched of result.shifts) {
            const existing = await this._attendanceRepo.getBySlot(input.employeeId, dateKey, matched.shiftId);

            if (matched.counted) {
                const attendance = existing ?? Attendance.create({
                    id:             UUIDv7(),
                    employeeId:     input.employeeId,
                    date:           dateKey,
                    shiftId:        matched.shiftId,
                    checkIn:        null,
                    checkOut:       null,
                    status:         AttendanceStatus.ABSENT,
                    workHours:      null,
                    lateMinutes:    0,
                    earlyMinutes:   0,
                    session:        AttendanceSession.FULL_DAY,
                    congWeight:     0,
                    source:         "manual",
                    note:           null,
                    leaveRequestId: null,
                });
                attendance.applyPunch({
                    checkIn:      input.checkIn ?? null,
                    checkOut:     input.checkOut ?? null,
                    status:       AttendanceStatus.create(matched.status),
                    workHours:    matched.workHours,
                    lateMinutes:  matched.lateMinutes,
                    earlyMinutes: matched.earlyMinutes,
                    session:      AttendanceSession.FULL_DAY,
                    congWeight:   matched.congWeight,
                    source:       "manual",
                });
                if (input.note !== undefined) attendance.changeNote(input.note);
                await this._attendanceRepo.save(attendance);
                records.push(attendance);
            } else if (existing != undefined && existing.source !== "leave") {
                await this._attendanceRepo.deleteById(existing.id);
            }
        }

        return { date: dateKey, totalCong: result.totalCong, records };
    }
}
