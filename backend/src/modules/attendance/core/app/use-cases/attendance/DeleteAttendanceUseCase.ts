import AttendancePeriodLockedError from "@modules/attendance/core/app/errors/AttendancePeriodLockedError";
import AttendancePeriodLockDirectory from "@modules/attendance/core/app/ports/AttendancePeriodLockDirectory";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";

const PERMISSION_KEY = "attendance:manage";

export interface DeleteAttendanceInput {
    attendanceId: string;
    actorUserId:  string;
}

/**
 * Xoá hẳn một bản ghi chấm công. Idempotent: bản ghi không tồn tại thì bỏ qua.
 *
 * Xoá cũng là một thao tác GHI nên cũng bị chặn khi kỳ đã chốt — nếu không thì
 * "chốt kỳ" chỉ ngăn được sửa mà vẫn cho xoá, tức là không chốt gì cả.
 *
 * @throws {AccessDeniedError}           Actor không có quyền `attendance:manage`.
 * @throws {AttendancePeriodLockedError} Bản ghi thuộc kỳ đã chốt chấm công.
 */
export default class DeleteAttendanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _attendanceRepo: AttendanceRepo,
        private readonly _periodLocks: AttendancePeriodLockDirectory,
    ) {}

    public async execute(input: DeleteAttendanceInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);

        const attendance = await this._attendanceRepo.getById(input.attendanceId);
        if (attendance == undefined) return;

        const locked = await this._periodLocks.findLockedPeriodCovering(attendance.date);
        if (locked != undefined) throw new AttendancePeriodLockedError(locked.name);

        await this._attendanceRepo.deleteById(input.attendanceId);
    }
}
