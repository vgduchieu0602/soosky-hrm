import PayrollStageInvalidError from "@modules/payroll/core/domain/errors/PayrollStageInvalidError";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const PAYROLL_PERIOD_STATUSES = ["open", "processing", "closed", "paid"] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];

/**
 * BƯỚC trong quy trình lương, chi tiết hơn `status`.
 *
 * `status` (4 giá trị) là hợp đồng cũ mà frontend đang đọc; `stage` là quy trình
 * thật gồm bảy bước: mở kỳ → đối soát công/đánh giá → tính thử → HR soát →
 * duyệt → chi trả → chốt kỳ. Giữ cả hai vì `status` không diễn tả được "đã tính
 * thử nhưng HR chưa soát", mà đó chính là chỗ cần chặn người duyệt bấm sớm.
 */
export const PAYROLL_PERIOD_STAGES = [
    "open", "reconciling", "trial", "hr_reviewed", "approved", "paid", "closed",
] as const;
export type PayrollPeriodStage = (typeof PAYROLL_PERIOD_STAGES)[number];

export interface PayrollPeriodCreationInput {
    id:               string;
    name:             PeriodName;
    startDate:        Date;
    endDate:          Date;
    payDate:          Date;
    standardWorkDays: number;
    createdBy:        string | null;
    evaluations?:     EmployeeEvaluation[];
}

/** Một dòng bảng đánh giá của một nhân viên trong kỳ lương. */
export interface EmployeeEvaluation {
    employeeId:       string;
    performanceScore: number | null;
    goalScore:        number | null;
    updatedAt:        Date | null;
    updatedBy:        string | null;
}

export interface UpsertEmployeeEvaluationInput {
    employeeId:       string;
    performanceScore: number;
    goalScore:        number;
    updatedBy:        string;
}

export interface PayrollPeriodProps {
    id:                    string;
    name:                  PeriodName;
    startDate:             Date;
    endDate:               Date;
    payDate:               Date;
    standardWorkDays:      number;
    status:                PayrollPeriodStatus;
    /** Vắng mặt trên document cũ -> mapper suy ra từ `status` (xem `PayrollPeriodMapper`). */
    stage?:                PayrollPeriodStage;
    hrReviewedBy?:         string | null;
    hrReviewedAt?:         Date | null;
    closedAt:              Date | null;
    closedBy:              string | null;
    attendanceLockedAt:    Date | null;
    attendanceLockedBy:    string | null;
    evaluationLockedAt:    Date | null;
    evaluationLockedBy:    string | null;
    /**
     * Người LẬP lương của kỳ — ghi lại ở lần chạy tính lương gần nhất.
     *
     * Có để phục vụ nguyên tắc bốn mắt: người duyệt phải khác người lập. Ghi
     * "lần chạy gần nhất" chứ không phải "lần đầu" vì đó mới là người chịu
     * trách nhiệm với con số đang chờ duyệt.
     */
    preparedBy:            string | null;
    preparedAt:            Date | null;
    createdBy:             string | null;
    createdAt:             Date;
    evaluations?:          EmployeeEvaluation[];
}

/**
 * Aggregate kỳ lương — một kỳ dùng chung cho chấm công, đánh giá và bảng
 * lương. Vòng đời: `open` → (chốt chấm công + chốt đánh giá) → tính lương
 * (draft) → duyệt (`processing`) → thanh toán (`paid`); hoặc `open` → `closed`
 * trực tiếp (chốt kỳ không qua thanh toán). Guard nghiệp vụ (không đóng khi
 * còn draft, không sửa khi đã khoá, …) nằm ở tầng use-case (cần đọc
 * `PayslipRepo`) — entity chỉ giữ trạng thái.
 */
export default class PayrollPeriod extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly createdAt: Date,
        private _name: PeriodName,
        private _startDate: Date,
        private _endDate: Date,
        private _payDate: Date,
        private _standardWorkDays: number,
        private _status: PayrollPeriodStatus,
        private _stage: PayrollPeriodStage,
        private _hrReviewedBy: string | null,
        private _hrReviewedAt: Date | null,
        private _closedAt: Date | null,
        private _closedBy: string | null,
        private _attendanceLockedAt: Date | null,
        private _attendanceLockedBy: string | null,
        private _evaluationLockedAt: Date | null,
        private _evaluationLockedBy: string | null,
        private _preparedBy: string | null,
        private _preparedAt: Date | null,
        private _createdBy: string | null,
        private _evaluations: EmployeeEvaluation[],
    ) {
        super();
    }

    get name(): PeriodName { return this._name; }
    get startDate(): Date { return this._startDate; }
    get endDate(): Date { return this._endDate; }
    get payDate(): Date { return this._payDate; }
    get standardWorkDays(): number { return this._standardWorkDays; }
    get status(): PayrollPeriodStatus { return this._status; }
    get stage(): PayrollPeriodStage { return this._stage; }
    get hrReviewedBy(): string | null { return this._hrReviewedBy; }
    get hrReviewedAt(): Date | null { return this._hrReviewedAt; }
    get closedAt(): Date | null { return this._closedAt; }
    get closedBy(): string | null { return this._closedBy; }
    get attendanceLockedAt(): Date | null { return this._attendanceLockedAt; }
    get attendanceLockedBy(): string | null { return this._attendanceLockedBy; }
    get evaluationLockedAt(): Date | null { return this._evaluationLockedAt; }
    get evaluationLockedBy(): string | null { return this._evaluationLockedBy; }
    get preparedBy(): string | null { return this._preparedBy; }
    get preparedAt(): Date | null { return this._preparedAt; }
    get createdBy(): string | null { return this._createdBy; }
    get evaluations(): readonly EmployeeEvaluation[] { return this._evaluations.map(evaluation => ({ ...evaluation })); }

    /** Cả hai chốt (chấm công + đánh giá) đã xong — đủ điều kiện tự động chạy lương. */
    get isFullyLocked(): boolean {
        return this._attendanceLockedAt != null && this._evaluationLockedAt != null;
    }

    static create(input: PayrollPeriodCreationInput): PayrollPeriod {
        return new PayrollPeriod(
            input.id, new Date(), input.name, input.startDate, input.endDate, input.payDate,
            input.standardWorkDays, "open", "open", null, null,
            null, null, null, null, null, null, null, null, input.createdBy, input.evaluations ?? [],
        );
    }

    static rehydrate(props: PayrollPeriodProps): PayrollPeriod {
        return new PayrollPeriod(
            props.id, props.createdAt, props.name, props.startDate, props.endDate, props.payDate,
            props.standardWorkDays, props.status,
            props.stage ?? "open", props.hrReviewedBy ?? null, props.hrReviewedAt ?? null,
            props.closedAt, props.closedBy,
            props.attendanceLockedAt, props.attendanceLockedBy,
            props.evaluationLockedAt, props.evaluationLockedBy,
            props.preparedBy ?? null, props.preparedAt ?? null,
            props.createdBy, props.evaluations ?? [],
        );
    }

    update(patch: { endDate?: Date; payDate?: Date; standardWorkDays?: number }): void {
        if (patch.endDate != undefined) this._endDate = patch.endDate;
        if (patch.payDate != undefined) this._payDate = patch.payDate;
        if (patch.standardWorkDays != undefined) this._standardWorkDays = patch.standardWorkDays;
    }

    /**
     * @throws {PayrollStageInvalidError} Chốt kỳ trước khi lương được duyệt.
     */
    close(byUserId: string): void {
        // Cho chốt từ `approved` (chi trả ngoài hệ thống) hoặc `paid`, nhưng KHÔNG
        // từ `trial`/`hr_reviewed`: chốt kỳ khi số chưa ai duyệt là mất luôn cơ hội
        // sửa mà không có ai chịu trách nhiệm cho con số đã đóng.
        this._assertStage("close period", ["approved", "paid", "closed"]);
        this._stage  = "closed";
        this._status = "closed";
        this._closedAt = new Date();
        this._closedBy = byUserId;
    }

    /** Mở lại kỳ đã chốt: quay về bước TÍNH THỬ — phải soát và duyệt lại từ đầu. */
    reopen(): void {
        this._stage    = "trial";
        this._status   = "open";
        this._closedAt = null;
        this._closedBy = null;
        this._clearHrReview();
    }

    lockAttendance(byUserId: string): void {
        this._attendanceLockedAt = new Date();
        this._attendanceLockedBy = byUserId;
        if (this._stage === "open") this._stage = "reconciling";
    }

    /** Mở khoá công = đầu vào đổi -> lùi về đối soát, xoá dấu HR đã soát. */
    unlockAttendance(): void {
        this._attendanceLockedAt = null;
        this._attendanceLockedBy = null;
        this._rewindToReconciling();
    }

    lockEvaluations(byUserId: string): void {
        this._evaluationLockedAt = new Date();
        this._evaluationLockedBy = byUserId;
    }

    unlockEvaluations(): void {
        this._evaluationLockedAt = null;
        this._evaluationLockedBy = null;
        this._rewindToReconciling();
    }

    getEvaluation(employeeId: string): EmployeeEvaluation | undefined {
        const evaluation = this._evaluations.find(item => item.employeeId === employeeId);
        return evaluation == undefined ? undefined : { ...evaluation };
    }

    hasCompleteEvaluationFor(employeeId: string): boolean {
        const evaluation = this.getEvaluation(employeeId);
        return evaluation?.performanceScore != null && evaluation.goalScore != null;
    }

    upsertEvaluation(input: UpsertEmployeeEvaluationInput): void {
        this._assertEvaluationScore(input.performanceScore);
        this._assertEvaluationScore(input.goalScore);

        const index = this._evaluations.findIndex(item => item.employeeId === input.employeeId);
        const evaluation: EmployeeEvaluation = {
            employeeId:       input.employeeId,
            performanceScore: input.performanceScore,
            goalScore:        input.goalScore,
            updatedAt:        new Date(),
            updatedBy:        input.updatedBy,
        };
        if (index === -1) this._evaluations.push(evaluation);
        else this._evaluations[index] = evaluation;
    }

    /**
     * HR xác nhận đã soát bảng lương thử -> mở cổng cho người duyệt.
     *
     * @throws {PayrollStageInvalidError} Kỳ chưa tính thử, hoặc đã qua bước này.
     */
    markHrReviewed(byUserId: string): void {
        this._assertStage("mark HR-reviewed", ["trial"]);
        this._stage        = "hr_reviewed";
        this._hrReviewedBy = byUserId;
        this._hrReviewedAt = new Date();
    }

    /**
     * @throws {PayrollStageInvalidError} HR chưa soát xong bảng lương thử.
     */
    markApproved(): void {
        // Duyệt được phép idempotent (duyệt bổ sung phiếu mới tính) nên `approved`
        // cũng hợp lệ; nhưng `trial` thì KHÔNG — đó là chỗ chặn "duyệt trước khi soát".
        this._assertStage("approve payroll", ["hr_reviewed", "approved"]);
        this._stage  = "approved";
        this._status = "processing";
    }

    /**
     * Ghi nhận ai vừa chạy tính lương cho kỳ này (người lập) và đưa kỳ về bước
     * TÍNH THỬ — mỗi lần tính lại là một bảng lương mới, phải soát lại.
     */
    markPrepared(byUserId: string): void {
        this._preparedBy = byUserId;
        this._preparedAt = new Date();
        if (this._stage !== "paid" && this._stage !== "closed") {
            this._stage = "trial";
            this._clearHrReview();
        }
    }

    /**
     * @throws {PayrollStageInvalidError} Lương chưa được duyệt.
     */
    markPaid(): void {
        this._assertStage("mark paid", ["approved"]);
        this._stage  = "paid";
        this._status = "paid";
    }

    private _assertStage(action: string, allowed: readonly PayrollPeriodStage[]): void {
        if (!allowed.includes(this._stage)) throw new PayrollStageInvalidError(action, this._stage, allowed);
    }

    /** Đầu vào của lương đổi: mọi xác nhận đã có không còn giá trị. */
    private _rewindToReconciling(): void {
        if (this._stage === "paid" || this._stage === "closed") return;
        this._stage = this._attendanceLockedAt != null || this._evaluationLockedAt != null ? "reconciling" : "open";
        this._clearHrReview();
    }

    private _clearHrReview(): void {
        this._hrReviewedBy = null;
        this._hrReviewedAt = null;
    }

    private _assertEvaluationScore(score: number): void {
        if (!Number.isFinite(score) || score < 0 || score > 100) {
            throw new Error("Evaluation score must be between 0 and 100");
        }
    }
}
