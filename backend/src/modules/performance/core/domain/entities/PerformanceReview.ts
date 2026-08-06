import PerformanceReviewInvalidError from "@modules/performance/core/domain/errors/PerformanceReviewInvalidError";
import PerformanceReviewTransitionError from "@modules/performance/core/domain/errors/PerformanceReviewTransitionError";
import Score from "@modules/performance/core/domain/value-objects/Score";
import AggregateRoot from "@shared/core/domain/AggregateRoot";

export const REVIEW_STATUSES = ["draft", "submitted", "approved", "acknowledged", "appealed", "locked"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const NOTE_MAX_LENGTH = 2000;

/** Điểm của một tiêu chí trong phiếu. */
export interface CriterionScore {
    criterionId: string;
    score:       number;
}

/** Ba con số tổng hợp từ điểm từng tiêu chí, thang 0..100. */
export interface ReviewTotals {
    kpiScore:         number;
    goalScore:        number;
    performanceScore: number;
}

export interface PerformanceReviewProps {
    id:         string;
    cycleId:    string;
    employeeId: string;
    /** Account của người chấm (thường là quản lý trực tiếp) do HR phân công. */
    reviewerUserId: string;
    /**
     * Phiên bản bộ tiêu chí dùng để chấm phiếu NÀY, sao chép từ chu kỳ lúc phân
     * công. Giữ ở phiếu (không đọc lại từ chu kỳ) để lịch sử đọc được độc lập.
     */
    criteriaSetId:   string;
    criteriaVersion: number;
    scores:  CriterionScore[];
    totals:  ReviewTotals | null;
    status:  ReviewStatus;
    managerNote:     string | null;
    strengths:       string | null;
    improvements:    string | null;
    developmentPlan: string | null;
    /** Lý do khiếu nại của nhân viên; giữ lại kể cả sau khi HR xử lý. */
    appealNote:  string | null;
    /** Ghi chú của HR khi duyệt / yêu cầu chấm lại / xử lý khiếu nại. */
    hrNote:      string | null;
    submittedAt: Date | null;
    approvedAt:  Date | null;
    approvedBy:  string | null;
    acknowledgedAt: Date | null;
    lockedAt:    Date | null;
    lockedBy:    string | null;
    createdAt:   Date;
}

export type PerformanceReviewCreationInput = Pick<PerformanceReviewProps,
    "id" | "cycleId" | "employeeId" | "reviewerUserId" | "criteriaSetId" | "criteriaVersion">;

export interface ScoreReviewInput {
    scores: CriterionScore[];
    totals: ReviewTotals;
    managerNote?: string | null | undefined;
    strengths?: string | null | undefined;
    improvements?: string | null | undefined;
    developmentPlan?: string | null | undefined;
}

/**
 * Phiếu đánh giá một nhân viên trong một chu kỳ.
 *
 * Vòng đời (một chiều tới `locked`):
 *
 *   draft ──score──► submitted ──approve(HR)──► approved
 *     ▲                              │              ├──acknowledge(NV)──► acknowledged ──lock(HR)──► locked
 *     └────requestChanges(HR)────────┘              └──appeal(NV)──────► appealed
 *     ▲                                                                     │
 *     └────resolveAppeal(HR, rescore=true)─────────────────────────────────┘
 *                    resolveAppeal(HR, rescore=false) ──► acknowledged
 *
 * `locked` là điểm cuối: điểm đã khoá mới được chụp vào bảng lương, và sau đó
 * không sửa được nữa. Muốn sửa thì phải mở khoá kỳ lương — luồng có quyền và
 * có nhật ký — chứ không sửa lén ở đây.
 */
export default class PerformanceReview extends AggregateRoot<string> {
    private constructor(
        public readonly id: string,
        public readonly cycleId: string,
        public readonly employeeId: string,
        public readonly criteriaSetId: string,
        public readonly criteriaVersion: number,
        public readonly createdAt: Date,
        private _reviewerUserId: string,
        private _scores: CriterionScore[],
        private _totals: ReviewTotals | null,
        private _status: ReviewStatus,
        private _managerNote: string | null,
        private _strengths: string | null,
        private _improvements: string | null,
        private _developmentPlan: string | null,
        private _appealNote: string | null,
        private _hrNote: string | null,
        private _submittedAt: Date | null,
        private _approvedAt: Date | null,
        private _approvedBy: string | null,
        private _acknowledgedAt: Date | null,
        private _lockedAt: Date | null,
        private _lockedBy: string | null,
    ) {
        super();
    }

    get reviewerUserId(): string { return this._reviewerUserId; }
    get scores(): readonly CriterionScore[] { return this._scores.map(s => ({ ...s })); }
    get totals(): ReviewTotals | null { return this._totals == null ? null : { ...this._totals }; }
    get status(): ReviewStatus { return this._status; }
    get managerNote(): string | null { return this._managerNote; }
    get strengths(): string | null { return this._strengths; }
    get improvements(): string | null { return this._improvements; }
    get developmentPlan(): string | null { return this._developmentPlan; }
    get appealNote(): string | null { return this._appealNote; }
    get hrNote(): string | null { return this._hrNote; }
    get submittedAt(): Date | null { return this._submittedAt; }
    get approvedAt(): Date | null { return this._approvedAt; }
    get approvedBy(): string | null { return this._approvedBy; }
    get acknowledgedAt(): Date | null { return this._acknowledgedAt; }
    get lockedAt(): Date | null { return this._lockedAt; }
    get lockedBy(): string | null { return this._lockedBy; }

    get isLocked(): boolean { return this._status === "locked"; }

    static create(input: PerformanceReviewCreationInput): PerformanceReview {
        return PerformanceReview.rehydrate({
            ...input,
            scores:  [],
            totals:  null,
            status:  "draft",
            managerNote: null, strengths: null, improvements: null, developmentPlan: null,
            appealNote: null, hrNote: null,
            submittedAt: null, approvedAt: null, approvedBy: null, acknowledgedAt: null,
            lockedAt: null, lockedBy: null,
            createdAt: new Date(),
        });
    }

    static rehydrate(props: PerformanceReviewProps): PerformanceReview {
        if (props.reviewerUserId.trim().length === 0) {
            throw new PerformanceReviewInvalidError("reviewerUserId must not be empty");
        }
        return new PerformanceReview(
            props.id, props.cycleId, props.employeeId, props.criteriaSetId, props.criteriaVersion, props.createdAt,
            props.reviewerUserId, props.scores, props.totals, props.status,
            props.managerNote, props.strengths, props.improvements, props.developmentPlan,
            props.appealNote, props.hrNote,
            props.submittedAt, props.approvedAt, props.approvedBy, props.acknowledgedAt,
            props.lockedAt, props.lockedBy,
        );
    }

    /**
     * HR đổi người chấm. Chỉ khi phiếu còn chưa chốt điểm — đổi người chấm sau
     * khi đã duyệt nghĩa là điểm hiện tại không còn ai đứng tên.
     *
     * @throws {PerformanceReviewTransitionError} Phiếu đã qua bước duyệt.
     */
    assignReviewer(reviewerUserId: string): void {
        if (this._status !== "draft" && this._status !== "submitted") {
            throw new PerformanceReviewTransitionError(this._status, "reassign reviewer of");
        }
        if (reviewerUserId.trim().length === 0) {
            throw new PerformanceReviewInvalidError("reviewerUserId must not be empty");
        }
        this._reviewerUserId = reviewerUserId;
    }

    /**
     * Người chấm nộp điểm. Gọi lại nhiều lần được khi phiếu còn `draft`/`submitted`
     * (sửa trước khi HR duyệt).
     *
     * @throws {PerformanceReviewTransitionError} Phiếu đã duyệt/khoá.
     * @throws {PerformanceReviewInvalidError}    Điểm ngoài thang 0..100.
     */
    score(input: ScoreReviewInput): void {
        if (this._status !== "draft" && this._status !== "submitted") {
            throw new PerformanceReviewTransitionError(this._status, "score");
        }

        // Ép qua VO để mọi điểm lọt vào phiếu đều nằm trên thang 0..100 —
        // bảng lương nhân trực tiếp con số này nên không được tin client.
        this._scores = input.scores.map(entry => ({ criterionId: entry.criterionId, score: Score.create(entry.score).value }));
        this._totals = {
            kpiScore:         Score.create(input.totals.kpiScore).value,
            goalScore:        Score.create(input.totals.goalScore).value,
            performanceScore: Score.create(input.totals.performanceScore).value,
        };

        this._managerNote     = trimNote(input.managerNote, "managerNote") ?? this._managerNote;
        this._strengths       = trimNote(input.strengths, "strengths") ?? this._strengths;
        this._improvements    = trimNote(input.improvements, "improvements") ?? this._improvements;
        this._developmentPlan = trimNote(input.developmentPlan, "developmentPlan") ?? this._developmentPlan;

        this._status      = "submitted";
        this._submittedAt = new Date();
    }

    /**
     * @throws {PerformanceReviewTransitionError} Phiếu chưa được chấm.
     */
    approve(approvedByUserId: string, hrNote: string | null): void {
        if (this._status !== "submitted" && this._status !== "appealed") {
            throw new PerformanceReviewTransitionError(this._status, "approve");
        }
        this._status     = "approved";
        this._approvedAt = new Date();
        this._approvedBy = approvedByUserId;
        this._hrNote     = trimNote(hrNote, "hrNote") ?? this._hrNote;
    }

    /**
     * HR trả phiếu về cho người chấm làm lại.
     *
     * @throws {PerformanceReviewTransitionError} Phiếu đã khoá.
     */
    requestChanges(hrNote: string): void {
        if (this._status === "locked") throw new PerformanceReviewTransitionError(this._status, "request changes on");

        const note = trimNote(hrNote, "hrNote");
        if (note == null) throw new PerformanceReviewInvalidError("hrNote is required when requesting changes");

        this._status     = "draft";
        this._hrNote     = note;
        this._approvedAt = null;
        this._approvedBy = null;
    }

    /**
     * Nhân viên xác nhận đã đọc và đồng ý.
     *
     * @throws {PerformanceReviewTransitionError} Phiếu chưa được HR duyệt.
     */
    acknowledge(): void {
        if (this._status !== "approved") throw new PerformanceReviewTransitionError(this._status, "acknowledge");
        this._status         = "acknowledged";
        this._acknowledgedAt = new Date();
    }

    /**
     * Nhân viên khiếu nại. Lý do BẮT BUỘC và được giữ lại vĩnh viễn, kể cả sau
     * khi HR xử lý — đó là dấu vết cho tranh chấp về sau.
     *
     * @throws {PerformanceReviewTransitionError} Phiếu chưa được HR duyệt.
     */
    appeal(reason: string): void {
        if (this._status !== "approved") throw new PerformanceReviewTransitionError(this._status, "appeal");

        const note = trimNote(reason, "appealNote");
        if (note == null) throw new PerformanceReviewInvalidError("Appeal reason must not be empty");

        this._status     = "appealed";
        this._appealNote = note;
    }

    /**
     * HR xử lý khiếu nại: `rescore = true` trả phiếu về cho người chấm; `false`
     * là giữ nguyên điểm và coi như nhân viên đã được trả lời (chuyển sang
     * `acknowledged` để còn khoá được).
     *
     * @throws {PerformanceReviewTransitionError} Phiếu không ở trạng thái khiếu nại.
     */
    resolveAppeal(hrNote: string, rescore: boolean): void {
        if (this._status !== "appealed") throw new PerformanceReviewTransitionError(this._status, "resolve appeal of");

        const note = trimNote(hrNote, "hrNote");
        if (note == null) throw new PerformanceReviewInvalidError("hrNote is required when resolving an appeal");
        this._hrNote = note;

        if (rescore) {
            this._status     = "draft";
            this._approvedAt = null;
            this._approvedBy = null;
            return;
        }

        this._status         = "acknowledged";
        this._acknowledgedAt = new Date();
    }

    /**
     * Khoá điểm — bước cuối, sau đó phiếu bất biến và điểm được chụp vào bảng lương.
     *
     * @throws {PerformanceReviewTransitionError} Phiếu chưa được nhân viên xác nhận.
     * @throws {PerformanceReviewInvalidError}    Phiếu chưa có điểm tổng hợp.
     */
    lock(lockedByUserId: string): ReviewTotals {
        if (this._status !== "acknowledged") throw new PerformanceReviewTransitionError(this._status, "lock");
        if (this._totals == null) throw new PerformanceReviewInvalidError("Cannot lock a review without scores");

        this._status   = "locked";
        this._lockedAt = new Date();
        this._lockedBy = lockedByUserId;

        return { ...this._totals };
    }
}

/**
 * Chuẩn hoá ghi chú: `undefined` = không đổi (trả `null` để caller giữ giá trị
 * cũ), chuỗi rỗng = xoá, chuỗi có nội dung = giá trị mới.
 */
function trimNote(raw: string | null | undefined, field: string): string | null {
    if (raw == undefined) return null;

    const trimmed = raw.trim();
    if (trimmed.length > NOTE_MAX_LENGTH) {
        throw new PerformanceReviewInvalidError(`${field} must be at most ${NOTE_MAX_LENGTH} characters`);
    }
    return trimmed.length === 0 ? null : trimmed;
}
