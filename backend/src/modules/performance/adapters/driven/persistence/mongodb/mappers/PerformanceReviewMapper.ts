import PerformanceReviewDocument from "@modules/performance/adapters/driven/persistence/mongodb/documents/PerformanceReviewDocument";
import PerformanceReview, { ReviewStatus } from "@modules/performance/core/domain/entities/PerformanceReview";

const PerformanceReviewMapper = {
    toDocument(review: PerformanceReview): PerformanceReviewDocument {
        return {
            _id:             review.id,
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
            submittedAt:     review.submittedAt,
            approvedAt:      review.approvedAt,
            approvedBy:      review.approvedBy,
            acknowledgedAt:  review.acknowledgedAt,
            lockedAt:        review.lockedAt,
            lockedBy:        review.lockedBy,
            createdAt:       review.createdAt,
        };
    },

    toDomain(document: PerformanceReviewDocument): PerformanceReview {
        return PerformanceReview.rehydrate({
            id:              document._id,
            cycleId:         document.cycleId,
            employeeId:      document.employeeId,
            reviewerUserId:  document.reviewerUserId,
            criteriaSetId:   document.criteriaSetId,
            criteriaVersion: document.criteriaVersion,
            scores:          document.scores.map(score => ({ ...score })),
            totals:          document.totals,
            status:          document.status as ReviewStatus,
            managerNote:     document.managerNote,
            strengths:       document.strengths,
            improvements:    document.improvements,
            developmentPlan: document.developmentPlan,
            appealNote:      document.appealNote,
            hrNote:          document.hrNote,
            submittedAt:     document.submittedAt,
            approvedAt:      document.approvedAt,
            approvedBy:      document.approvedBy,
            acknowledgedAt:  document.acknowledgedAt,
            lockedAt:        document.lockedAt,
            lockedBy:        document.lockedBy,
            createdAt:       document.createdAt,
        });
    },
};

export default PerformanceReviewMapper;
