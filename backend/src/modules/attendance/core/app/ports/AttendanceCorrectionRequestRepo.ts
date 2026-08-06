import AttendanceCorrectionRequest, { CorrectionStatus } from "@modules/attendance/core/domain/entities/AttendanceCorrectionRequest";

export interface CorrectionListFilter {
    /** Thu hẹp về đúng tập nhân viên này (phân quyền `team`/`self`). Rỗng → không trả gì. */
    employeeIds?: readonly string[] | undefined;
    status?: CorrectionStatus | undefined;
}

export default interface AttendanceCorrectionRequestRepo {
    getById(id: string): Promise<AttendanceCorrectionRequest | undefined>;
    list(filter: CorrectionListFilter): Promise<AttendanceCorrectionRequest[]>;
    /** Yêu cầu đang chờ duyệt của nhân viên tại đúng ngày này — chặn gửi trùng. */
    findPendingByEmployeeAndDate(employeeId: string, date: Date): Promise<AttendanceCorrectionRequest | undefined>;
    save(request: AttendanceCorrectionRequest): Promise<void>;
}
