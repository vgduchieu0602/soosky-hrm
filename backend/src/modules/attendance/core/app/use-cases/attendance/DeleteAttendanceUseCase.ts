import PermissionChecker from "@modules/attendance/core/app/ports/PermissionChecker";
import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";

const PERMISSION_KEY = "attendance:manage";

export interface DeleteAttendanceInput {
    attendanceId: string;
    actorUserId:  string;
}

/**
 * Xoá hẳn một bản ghi chấm công. Idempotent: bản ghi không tồn tại thì bỏ qua.
 *
 * @throws {AccessDeniedError} Actor không có quyền `attendance:manage`.
 */
export default class DeleteAttendanceUseCase {
    public constructor(
        private readonly _permissions: PermissionChecker,
        private readonly _attendanceRepo: AttendanceRepo,
    ) {}

    public async execute(input: DeleteAttendanceInput): Promise<void> {
        await this._permissions.assertPermission(input.actorUserId, PERMISSION_KEY);
        await this._attendanceRepo.deleteById(input.attendanceId);
    }
}
