import AppraisalCycleInvalidError from "@modules/performance/core/domain/errors/AppraisalCycleInvalidError";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const CYCLE_STATUSES = ["draft", "active", "closed"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

const NAME_MAX_LENGTH = 60;

export interface AppraisalCycleProps {
    id:   string;
    name: string;
    /**
     * Kỳ lương mà chu kỳ đánh giá này phục vụ. BẮT BUỘC: điểm đã khoá được
     * chụp vào đúng kỳ lương này, đó là toàn bộ lý do chu kỳ tồn tại.
     */
    payrollPeriodId: string;
    criteriaSetId:   string;
    /** Phiên bản bộ tiêu chí chốt cho cả chu kỳ — không đổi sau khi mở. */
    criteriaVersion: number;
    status:    CycleStatus;
    createdBy: string;
    createdAt: Date;
    activatedAt: Date | null;
    closedAt:    Date | null;
}

export type AppraisalCycleCreationInput =
    Omit<AppraisalCycleProps, "status" | "createdAt" | "activatedAt" | "closedAt">;

/**
 * Chu kỳ đánh giá — gắn một kỳ lương với một PHIÊN BẢN bộ tiêu chí.
 *
 * Phiên bản được chốt tại đây thay vì đọc "phiên bản mới nhất" lúc chấm: nếu
 * đọc bản mới nhất thì phát hành tiêu chí mới giữa chu kỳ sẽ khiến người chấm
 * sau dùng thang khác người chấm trước, trong cùng một chu kỳ.
 *
 * Vòng đời: `draft` (đang phân công) → `active` (đang chấm) → `closed` (đã
 * khoá xong điểm). Một chiều: mở lại chu kỳ đã đóng nghĩa là điểm đã vào lương
 * có thể đổi — muốn sửa thì mở khoá kỳ lương trước, đó là luồng có kiểm soát.
 */
export default class AppraisalCycle extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly payrollPeriodId: string,
        public readonly criteriaSetId: string,
        public readonly criteriaVersion: number,
        public readonly createdBy: string,
        public readonly createdAt: Date,
        private _name: string,
        private _status: CycleStatus,
        private _activatedAt: Date | null,
        private _closedAt: Date | null,
    ) {
        super();
    }

    get name(): string { return this._name; }
    get status(): CycleStatus { return this._status; }
    get activatedAt(): Date | null { return this._activatedAt; }
    get closedAt(): Date | null { return this._closedAt; }

    get isDraft(): boolean { return this._status === "draft"; }
    get isActive(): boolean { return this._status === "active"; }
    get isClosed(): boolean { return this._status === "closed"; }

    static create(input: AppraisalCycleCreationInput): AppraisalCycle {
        return AppraisalCycle.rehydrate({
            ...input,
            status:      "draft",
            createdAt:   new Date(),
            activatedAt: null,
            closedAt:    null,
        });
    }

    static rehydrate(props: AppraisalCycleProps): AppraisalCycle {
        const name = props.name.trim();
        if (name.length === 0) throw new AppraisalCycleInvalidError("Cycle name must not be empty");
        if (name.length > NAME_MAX_LENGTH) {
            throw new AppraisalCycleInvalidError(`Cycle name must be at most ${NAME_MAX_LENGTH} characters`);
        }
        if (!Number.isInteger(props.criteriaVersion) || props.criteriaVersion < 1) {
            throw new AppraisalCycleInvalidError("criteriaVersion must be a positive integer");
        }

        return new AppraisalCycle(
            props.id, props.payrollPeriodId, props.criteriaSetId, props.criteriaVersion,
            props.createdBy, props.createdAt,
            name, props.status, props.activatedAt, props.closedAt,
        );
    }

    /**
     * @throws {AppraisalCycleInvalidError} Chu kỳ không còn ở trạng thái `draft`.
     */
    activate(): void {
        if (!this.isDraft) throw new AppraisalCycleInvalidError(`Cycle is already ${this._status}`);
        this._status      = "active";
        this._activatedAt = new Date();
    }

    /**
     * @throws {AppraisalCycleInvalidError} Chu kỳ chưa mở, hoặc đã đóng.
     */
    close(): void {
        if (!this.isActive) throw new AppraisalCycleInvalidError(`Cannot close a cycle in status "${this._status}"`);
        this._status   = "closed";
        this._closedAt = new Date();
    }
}
