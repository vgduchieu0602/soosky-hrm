/** Dạng document lưu trữ của aggregate `PerformanceReview`. */
export interface CriterionScoreSubDocument {
    criterionId: string;
    score:       number;
}

export interface ReviewTotalsSubDocument {
    kpiScore:         number;
    goalScore:        number;
    performanceScore: number;
}

export default interface PerformanceReviewDocument {
    _id:             string;
    cycleId:         string;
    employeeId:      string;
    reviewerUserId:  string;
    criteriaSetId:   string;
    criteriaVersion: number;
    scores:          CriterionScoreSubDocument[];
    totals:          ReviewTotalsSubDocument | null;
    status:          string;
    managerNote:     string | null;
    strengths:       string | null;
    improvements:    string | null;
    developmentPlan: string | null;
    appealNote:      string | null;
    hrNote:          string | null;
    submittedAt:     Date | null;
    approvedAt:      Date | null;
    approvedBy:      string | null;
    acknowledgedAt:  Date | null;
    lockedAt:        Date | null;
    lockedBy:        string | null;
    createdAt:       Date;
}
