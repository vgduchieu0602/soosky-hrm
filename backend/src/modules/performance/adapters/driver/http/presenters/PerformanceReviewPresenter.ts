import PerformanceReview from "@modules/performance/core/domain/entities/PerformanceReview";

export interface PerformanceReviewDTO {
    id:              string;
    cycleId:         string;
    employeeId:      string;
    reviewerUserId:  string;
    criteriaSetId:   string;
    criteriaVersion: number;
    scores:          { criterionId: string; score: number }[];
    /** `null` khi phiếu chưa được chấm. */
    totals:          { kpiScore: number; goalScore: number; performanceScore: number } | null;
    status:          string;
    managerNote:     string | null;
    strengths:       string | null;
    improvements:    string | null;
    developmentPlan: string | null;
    appealNote:      string | null;
    hrNote:          string | null;
    submittedAt:     string | null;
    approvedAt:      string | null;
    approvedBy:      string | null;
    acknowledgedAt:  string | null;
    lockedAt:        string | null;
    lockedBy:        string | null;
    createdAt:       string;
}

const PerformanceReviewPresenter = {
    toDTO(review: PerformanceReview): PerformanceReviewDTO {
        return {
            id:              review.id,
            cycleId:         review.cycleId,
            employeeId:      review.employeeId,
            reviewerUserId:  review.reviewerUserId,
            criteriaSetId:   review.criteriaSetId,
            criteriaVersion: review.criteriaVersion,
            scores:          review.scores.map(score => ({ ...score })),
            totals:          review.totals,
            status:          review.status,
            managerNote:     review.managerNote,
            strengths:       review.strengths,
            improvements:    review.improvements,
            developmentPlan: review.developmentPlan,
            appealNote:      review.appealNote,
            hrNote:          review.hrNote,
            submittedAt:     review.submittedAt?.toISOString() ?? null,
            approvedAt:      review.approvedAt?.toISOString() ?? null,
            approvedBy:      review.approvedBy,
            acknowledgedAt:  review.acknowledgedAt?.toISOString() ?? null,
            lockedAt:        review.lockedAt?.toISOString() ?? null,
            lockedBy:        review.lockedBy,
            createdAt:       review.createdAt.toISOString(),
        };
    },
};

export default PerformanceReviewPresenter;
