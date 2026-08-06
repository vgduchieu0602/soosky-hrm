import AttendanceRepo from "@modules/attendance/core/app/ports/AttendanceRepo";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";
import Attendance from "@modules/attendance/core/domain/entities/Attendance";

export interface ListAttendanceInput {
    /**
     * Nhân viên cần xem bảng công. BỎ TRỐNG = "bảng công của chính tôi", suy ra
     * từ tài khoản đang đăng nhập — client tự phục vụ không cần biết employeeId
     * của mình và cũng không thể gửi id của người khác.
     */
    employeeId?: string | undefined;
    start:       Date;
    end:         Date;
    actorUserId: string;
}

/**
 * Liệt kê bản ghi chấm công của một nhân viên trong một khoảng ngày, trong phạm
 * vi actor được xem: HR/Admin xem mọi người, Manager xem cấp dưới, Employee chỉ
 * xem chính mình.
 *
 * @throws {AccessDeniedError} Không có quyền xem bảng công, hoặc nhân viên được
 *                             yêu cầu nằm ngoài phạm vi của actor.
 */
export default class ListAttendanceUseCase {
    public constructor(
        private readonly _accessScope: AttendanceAccessScope,
        private readonly _attendanceRepo: AttendanceRepo,
    ) {}

    public async execute(input: ListAttendanceInput): Promise<Attendance[]> {
        const employeeId = await this._accessScope.resolveReadSubjectEmployeeId(input.actorUserId, input.employeeId);
        return this._attendanceRepo.listByEmployeeAndRange(employeeId, input.start, input.end);
    }
}
