import RetroAdjustmentInvalidError from "@modules/payroll/core/domain/errors/RetroAdjustmentInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const RETRO_KINDS = ["claim", "clawback"] as const;
/** `claim` = truy lĩnh (trả thêm cho NLĐ) · `clawback` = truy thu (thu hồi tiền đã trả thừa). */
export type RetroKind = (typeof RETRO_KINDS)[number];

export const RETRO_STATUSES = ["active", "cancelled"] as const;
export type RetroStatus = (typeof RETRO_STATUSES)[number];

const REASON_MAX_LENGTH = 500;

export interface RetroAdjustmentProps {
    id:         string;
    employeeId: string;
    kind:       RetroKind;
    /** Số tiền tuyệt đối, luôn > 0. Chiều tiền do `kind` quyết định, không dùng số âm. */
    amount:     number;
    /** Chỉ áp dụng cho `claim`: khoản truy lĩnh này có chịu thuế TNCN hay không. */
    taxable:    boolean;
    /** Kỳ lương BỊ SAI — thứ làm khoản này khác một dòng thưởng/khấu trừ thường. */
    originPeriodId: string;
    /** Kỳ lương sẽ chi trả/thu hồi khoản này. */
    payoutPeriodId: string;
    reason:     string;
    status:     RetroStatus;
    createdBy:  string;
    createdAt:  Date;
    cancelledBy: string | null;
    cancelledAt: Date | null;
    cancelReason: string | null;
}

export type RetroAdjustmentCreationInput = Pick<RetroAdjustmentProps,
    "id" | "employeeId" | "kind" | "amount" | "taxable" | "originPeriodId" | "payoutPeriodId" | "reason" | "createdBy">;

/**
 * Điều chỉnh hồi tố: truy lĩnh hoặc truy thu cho một kỳ lương ĐÃ QUA.
 *
 * Vì sao là khái niệm riêng thay vì một dòng thưởng/khấu trừ: khoản này luôn
 * tham chiếu KỲ GỐC bị tính sai. Nhét vào thưởng thì phiếu lương hiện "thưởng
 * 1.2tr" mà không ai biết đó là bù lương tháng 10, và báo cáo thưởng bị lẫn tiền
 * sửa sai.
 *
 * Không sửa được sau khi tạo — chỉ `cancel`. Sai số tiền thì huỷ và tạo bản mới,
 * để lịch sử đọc được theo đúng thứ tự đã xảy ra.
 */
export default class RetroAdjustment extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly employeeId: string,
        public readonly kind: RetroKind,
        public readonly amount: number,
        public readonly taxable: boolean,
        public readonly originPeriodId: string,
        public readonly payoutPeriodId: string,
        public readonly reason: string,
        public readonly createdBy: string,
        public readonly createdAt: Date,
        private _status: RetroStatus,
        private _cancelledBy: string | null,
        private _cancelledAt: Date | null,
        private _cancelReason: string | null,
    ) {
        super();
    }

    get status(): RetroStatus { return this._status; }
    get cancelledBy(): string | null { return this._cancelledBy; }
    get cancelledAt(): Date | null { return this._cancelledAt; }
    get cancelReason(): string | null { return this._cancelReason; }

    get isActive(): boolean { return this._status === "active"; }

    static create(input: RetroAdjustmentCreationInput): RetroAdjustment {
        return RetroAdjustment.rehydrate({
            ...input,
            status:       "active",
            createdAt:    new Date(),
            cancelledBy:  null,
            cancelledAt:  null,
            cancelReason: null,
        });
    }

    static rehydrate(props: RetroAdjustmentProps): RetroAdjustment {
        if (!Number.isFinite(props.amount) || props.amount <= 0) {
            throw new RetroAdjustmentInvalidError("amount must be greater than 0 (direction is decided by `kind`)");
        }

        const reason = props.reason.trim();
        if (reason.length === 0) {
            throw new RetroAdjustmentInvalidError("reason must not be empty");
        }
        if (reason.length > REASON_MAX_LENGTH) {
            throw new RetroAdjustmentInvalidError(`reason must be at most ${REASON_MAX_LENGTH} characters`);
        }

        // Truy hồi tố cho chính kỳ chi trả thì không phải hồi tố — đó là thưởng
        // hoặc khấu trừ thường, đã có `Bonus`/`Deduction` cho việc đó.
        if (props.originPeriodId === props.payoutPeriodId) {
            throw new RetroAdjustmentInvalidError("originPeriodId must differ from payoutPeriodId; use a bonus/deduction instead");
        }

        return new RetroAdjustment(
            props.id, props.employeeId, props.kind, Math.round(props.amount),
            // `taxable` chỉ có nghĩa với truy lĩnh; truy thu luôn khấu trừ sau thuế.
            props.kind === "claim" ? props.taxable : false,
            props.originPeriodId, props.payoutPeriodId, reason,
            props.createdBy, props.createdAt,
            props.status, props.cancelledBy, props.cancelledAt, props.cancelReason,
        );
    }

    /**
     * @throws {RetroAdjustmentInvalidError} Đã huỷ trước đó, hoặc thiếu lý do huỷ.
     */
    cancel(byUserId: string, reason: string): void {
        if (!this.isActive) throw new RetroAdjustmentInvalidError("Adjustment is already cancelled");

        const trimmed = reason.trim();
        if (trimmed.length === 0) throw new RetroAdjustmentInvalidError("Cancel reason must not be empty");

        this._status       = "cancelled";
        this._cancelledBy  = byUserId;
        this._cancelledAt  = new Date();
        this._cancelReason = trimmed;
    }
}
