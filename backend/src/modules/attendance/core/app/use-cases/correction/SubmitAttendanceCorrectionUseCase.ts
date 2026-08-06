import AttendanceCorrectionConflictError from "@modules/attendance/core/app/errors/AttendanceCorrectionConflictError";
import AttendancePeriodLockedError from "@modules/attendance/core/app/errors/AttendancePeriodLockedError";
import EmployeeNotFoundError from "@modules/attendance/core/app/errors/EmployeeNotFoundError";
import AttendanceCorrectionRequestRepo from "@modules/attendance/core/app/ports/AttendanceCorrectionRequestRepo";
import AttendancePeriodLockDirectory from "@modules/attendance/core/app/ports/AttendancePeriodLockDirectory";
import AuditTrail from "@modules/attendance/core/app/ports/AuditTrail";
import CompanyCalendarDirectory from "@modules/attendance/core/app/ports/CompanyCalendarDirectory";
import EmployeeDirectory from "@modules/attendance/core/app/ports/EmployeeDirectory";
import AttendanceAccessScope from "@modules/attendance/core/app/services/AttendanceAccessScope";
import AttendanceCorrectionRequest from "@modules/attendance/core/domain/entities/AttendanceCorrectionRequest";
import { vnDateKey } from "@modules/attendance/core/domain/services/attendance-calc";
import createUuidV7 from "@shared/core/domain/UuidV7";

export interface SubmitAttendanceCorrectionInput {
    /** Bỏ trống = yêu cầu cho chính mình (suy ra từ tài khoản đang đăng nhập). */
    employeeId?: string | undefined;
    date:        Date;
    requestedCheckIn?: Date | undefined;
    requestedCheckOut?: Date | undefined;
    reason:      string;
    actorUserId: string;
}

export interface SubmitAttendanceCorrectionOutput {
    correctionRequestId: string;
}

/**
 * Nhân viên gửi yêu cầu chỉnh công (quên bấm giờ ra, bấm sai giờ, ...). Không
 * ghi gì vào bảng công ở bước này — chỉ khi quản lý/HR duyệt.
 *
 * Chặn kỳ ĐÃ CHỐT ngay từ khâu gửi: gửi yêu cầu cho một ngày không thể sửa được
 * nữa chỉ tạo ra hàng chờ chắc chắn sẽ bị từ chối. Báo sớm để người gửi biết
 * phải nhờ HR mở khoá kỳ.
 *
 * Chặn gửi TRÙNG (một yêu cầu `pending` cho cùng ngày): hai yêu cầu chờ duyệt
 * trên cùng một ngày thì duyệt cả hai sẽ ghi đè lẫn nhau, kết quả phụ thuộc thứ
 * tự bấm nút.
 *
 * @throws {AccessDeniedError}                Không được gửi yêu cầu cho nhân viên này.
 * @throws {EmployeeNotFoundError}            Nhân viên không tồn tại.
 * @throws {AttendancePeriodLockedError}      Ngày này thuộc kỳ đã chốt chấm công.
 * @throws {AttendanceCorrectionConflictError} Đã có yêu cầu chờ duyệt cho ngày này.
 * @throws {AttendanceCorrectionInvalidError}  Thiếu lý do, hoặc không nêu giờ nào, hoặc giờ ra ≤ giờ vào.
 */
export default class SubmitAttendanceCorrectionUseCase {
    public constructor(
        private readonly _accessScope: AttendanceAccessScope,
        private readonly _requestRepo: AttendanceCorrectionRequestRepo,
        private readonly _employeeDirectory: EmployeeDirectory,
        private readonly _companyCalendar: CompanyCalendarDirectory,
        private readonly _periodLocks: AttendancePeriodLockDirectory,
        private readonly _auditTrail: AuditTrail,
    ) {}

    public async execute(input: SubmitAttendanceCorrectionInput): Promise<SubmitAttendanceCorrectionOutput> {
        const employeeId = await this._accessScope.resolveCorrectionSubjectEmployeeId(input.actorUserId, input.employeeId);

        if (!await this._employeeDirectory.employeeExists(employeeId)) throw new EmployeeNotFoundError();

        const dateKey = vnDateKey(input.date, await this._companyCalendar.timezone());

        const locked = await this._periodLocks.findLockedPeriodCovering(dateKey);
        if (locked != undefined) throw new AttendancePeriodLockedError(locked.name);

        const pending = await this._requestRepo.findPendingByEmployeeAndDate(employeeId, dateKey);
        if (pending != undefined) throw new AttendanceCorrectionConflictError(pending.id);

        const requested = AttendanceCorrectionRequest.create({
            id:                createUuidV7(),
            employeeId,
            date:              dateKey,
            requestedCheckIn:  input.requestedCheckIn ?? null,
            requestedCheckOut: input.requestedCheckOut ?? null,
            reason:            input.reason,
            createdBy:         input.actorUserId,
        });

        await this._requestRepo.save(requested);

        await this._auditTrail.record({
            actorUserId: input.actorUserId,
            resource:    "attendance_correction",
            action:      "submit",
            resourceId:  requested.id,
            changes:     {
                employeeId,
                date:              dateKey,
                requestedCheckIn:  requested.requestedCheckIn,
                requestedCheckOut: requested.requestedCheckOut,
                reason:            requested.reason,
            },
        });

        return { correctionRequestId: requested.id };
    }
}
