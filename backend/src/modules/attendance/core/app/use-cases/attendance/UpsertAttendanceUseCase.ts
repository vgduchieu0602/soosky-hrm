import EmployeeNotFoundError from "@modules/attendance/core/app/errors/EmployeeNotFoundError";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AttendanceDayWriter from "@modules/attendance/core/app/services/AttendanceDayWriter";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";

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
 * HR nhập MỘT cặp check-in/check-out cho một ngày.
 *
 * Toàn bộ việc phân bổ ca, tính trễ/sớm, xử lý thiếu giờ ra, ngày lễ và chặn kỳ
 * đã chốt nằm ở {@link AttendanceDayWriter} — dùng chung với luồng chỉnh công
 * được duyệt, để hai đường vào không bao giờ cho ra số công khác nhau.
 *
 * `employeeId` BẮT BUỘC ở đây: chấm công không có tự phục vụ, luôn là HR nhập
 * cho một người cụ thể (xem ghi chú ở `attendance:manage` trong `seedIam.ts`).
 *
 * @throws {AccessDeniedError}           Actor không có quyền `attendance:manage`.
 * @throws {EmployeeNotFoundError}       Nhân viên không tồn tại.
 * @throws {AttendancePeriodLockedError} Ngày này thuộc kỳ đã chốt chấm công.
 * @throws {NoApplicableShiftError}      Không có ca nào áp dụng cho ngày trong tuần này.
 */
export default class UpsertAttendanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _employeeDirectory: EmployeeDirectory,
        private readonly _dayWriter: AttendanceDayWriter,
    ) {}

    public async execute(input: UpsertAttendanceInput): Promise<UpsertAttendanceOutput> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const exists = await this._employeeDirectory.employeeExists(input.employeeId);
        if (!exists) throw new EmployeeNotFoundError();

        return this._dayWriter.write({
            employeeId: input.employeeId,
            date:       input.date,
            checkIn:    input.checkIn,
            checkOut:   input.checkOut,
            note:       input.note,
            source:     "manual",
        });
    }
}
