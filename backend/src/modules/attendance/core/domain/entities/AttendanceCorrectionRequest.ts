import AttendanceCorrectionInvalidError from "@modules/attendance/core/domain/errors/AttendanceCorrectionInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const CORRECTION_STATUSES = ["pending", "approved", "rejected"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

const REASON_MAX_LENGTH = 500;

export interface AttendanceCorrectionRequestProps {
    id:         string;
    employeeId: string;
    /** Ngày cần chỉnh (date-key 00:00 UTC theo timezone công ty). */
    date:       Date;
    requestedCheckIn:  Date | null;
    requestedCheckOut: Date | null;
    /** Lý do do người gửi nêu — BẮT BUỘC, đây là chứng cứ cho người duyệt. */
    reason:     string;
    status:     CorrectionStatus;
    createdBy:  string;
    createdAt:  Date;
    decidedBy:  string | null;
    decidedAt:  Date | null;
    /** Ghi chú của người duyệt, hoặc lý do từ chối. */
    decisionNote: string | null;
}

export type AttendanceCorrectionRequestCreationInput =
    Omit<AttendanceCorrectionRequestProps, "status" | "createdAt" | "decidedBy" | "decidedAt" | "decisionNote">;

/**
 * Yêu cầu chỉnh công: nhân viên KHÔNG sửa trực tiếp bảng công, chỉ đề nghị giờ
 * vào/ra đúng kèm lý do; quản lý trực tiếp hoặc HR duyệt thì hệ thống mới ghi.
 *
 * Vì sao cần aggregate riêng thay vì cho nhân viên sửa rồi HR kiểm sau: bảng
 * công là đầu vào của lương. Sửa trước – kiểm sau nghĩa là có khoảng thời gian
 * số liệu sai đã nằm trong hệ thống, và không còn dấu vết ai đề nghị gì.
 *
 * Vòng đời một chiều: `pending` → `approved` | `rejected`. Đã quyết định thì
 * không quay lại được — muốn đổi thì gửi yêu cầu mới, để lịch sử luôn đọc được
 * theo đúng thứ tự đã xảy ra.
 */
export default class AttendanceCorrectionRequest extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly date: Date,
        public readonly requestedCheckIn: Date | null,
        public readonly requestedCheckOut: Date | null,
        public readonly reason: string,
        public readonly createdBy: string,
        public readonly createdAt: Date,
        private _status: CorrectionStatus,
        private _decidedBy: string | null,
        private _decidedAt: Date | null,
        private _decisionNote: string | null,
    ) {
        super();
    }

    get status(): CorrectionStatus { return this._status; }
    get decidedBy(): string | null { return this._decidedBy; }
    get decidedAt(): Date | null { return this._decidedAt; }
    get decisionNote(): string | null { return this._decisionNote; }

    get isPending(): boolean { return this._status === "pending"; }

    static create(input: AttendanceCorrectionRequestCreationInput): AttendanceCorrectionRequest {
        return AttendanceCorrectionRequest.rehydrate({
            ...input,
            status:       "pending",
            createdAt:    new Date(),
            decidedBy:    null,
            decidedAt:    null,
            decisionNote: null,
        });
    }

    static rehydrate(props: AttendanceCorrectionRequestProps): AttendanceCorrectionRequest {
        const reason = props.reason.trim();
        if (reason.length === 0) {
            throw new AttendanceCorrectionInvalidError("Reason must not be empty");
        }
        if (reason.length > REASON_MAX_LENGTH) {
            throw new AttendanceCorrectionInvalidError(`Reason must be at most ${REASON_MAX_LENGTH} characters`);
        }

        // Yêu cầu không nêu giờ nào cả thì không có gì để áp dụng.
        if (props.requestedCheckIn == null && props.requestedCheckOut == null) {
            throw new AttendanceCorrectionInvalidError("At least one of requestedCheckIn / requestedCheckOut is required");
        }
        if (props.requestedCheckIn != null && props.requestedCheckOut != null
            && props.requestedCheckOut <= props.requestedCheckIn) {
            throw new AttendanceCorrectionInvalidError("requestedCheckOut must be after requestedCheckIn");
        }

        return new AttendanceCorrectionRequest(
            props.id, props.employeeId, props.date,
            props.requestedCheckIn, props.requestedCheckOut,
            reason, props.createdBy, props.createdAt,
            props.status, props.decidedBy, props.decidedAt, props.decisionNote,
        );
    }

    /**
     * @throws {AttendanceCorrectionInvalidError} Yêu cầu đã được quyết định.
     */
    approve(decidedByUserId: string, note: string | null): void {
        this._assertPending();
        this._status       = "approved";
        this._decidedBy    = decidedByUserId;
        this._decidedAt    = new Date();
        this._decisionNote = note;
    }

    /**
     * @throws {AttendanceCorrectionInvalidError} Yêu cầu đã được quyết định, hoặc thiếu lý do từ chối.
     */
    reject(decidedByUserId: string, reason: string): void {
        this._assertPending();

        const trimmed = reason.trim();
        if (trimmed.length === 0) {
            throw new AttendanceCorrectionInvalidError("Rejection reason must not be empty");
        }

        this._status       = "rejected";
        this._decidedBy    = decidedByUserId;
        this._decidedAt    = new Date();
        this._decisionNote = trimmed;
    }

    private _assertPending(): void {
        if (!this.isPending) {
            throw new AttendanceCorrectionInvalidError(`Request is already ${this._status}`);
        }
    }
}
