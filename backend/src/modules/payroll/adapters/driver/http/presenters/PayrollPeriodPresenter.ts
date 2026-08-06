import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";

export interface PayrollPeriodDTO {
    id:                  string;
    name:                string;
    startDate:           string;
    endDate:             string;
    payDate:             string;
    standardWorkDays:    number;
    status:              string;
    /** Bước trong quy trình 7 bước — chi tiết hơn `status`. */
    stage:               string;
    hrReviewedBy:        string | null;
    hrReviewedAt:        string | null;
    closedAt:            string | null;
    closedBy:            string | null;
    attendanceLockedAt:  string | null;
    attendanceLockedBy:  string | null;
    evaluationLockedAt:  string | null;
    evaluationLockedBy:  string | null;
    createdBy:           string | null;
    createdAt:           string;
}

const PayrollPeriodPresenter = {
    toDTO(period: PayrollPeriod): PayrollPeriodDTO {
        return {
            id:                 period.id,
            name:               period.name.value,
            startDate:          period.startDate.toISOString(),
            endDate:            period.endDate.toISOString(),
            payDate:            period.payDate.toISOString(),
            standardWorkDays:   period.standardWorkDays,
            status:             period.status,
            stage:              period.stage,
            hrReviewedBy:       period.hrReviewedBy,
            hrReviewedAt:       period.hrReviewedAt?.toISOString() ?? null,
            closedAt:           period.closedAt?.toISOString() ?? null,
            closedBy:           period.closedBy,
            attendanceLockedAt: period.attendanceLockedAt?.toISOString() ?? null,
            attendanceLockedBy: period.attendanceLockedBy,
            evaluationLockedAt: period.evaluationLockedAt?.toISOString() ?? null,
            evaluationLockedBy: period.evaluationLockedBy,
            createdBy:          period.createdBy,
            createdAt:          period.createdAt.toISOString(),
        };
    },
};

export default PayrollPeriodPresenter;
