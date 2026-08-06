import PayrollPeriodDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayrollPeriodDocument";
import PayrollPeriod, { PayrollPeriodStage, PayrollPeriodStatus } from "@modules/payroll/core/domain/entities/PayrollPeriod";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";

/**
 * Bước của kỳ lương cũ (ghi trước khi có `stage`) suy ra từ `status`.
 *
 * `processing` map sang `approved` — trước đây kỳ chỉ chuyển `processing` khi đã
 * duyệt lương. `open` về `open` chứ không phải `reconciling`: bước đối soát sẽ
 * tự đúng lại ngay lần chốt công / tính lương kế tiếp.
 */
function stageFromStatus(status: PayrollPeriodStatus): PayrollPeriodStage {
    if (status === "paid")       return "paid";
    if (status === "closed")     return "closed";
    if (status === "processing") return "approved";
    return "open";
}

const PayrollPeriodMapper = {
    toDocument(period: PayrollPeriod): PayrollPeriodDocument {
        return {
            _id:                period.id,
            name:               period.name.value,
            startDate:          period.startDate,
            endDate:            period.endDate,
            payDate:            period.payDate,
            standardWorkDays:   period.standardWorkDays,
            status:             period.status,
            stage:              period.stage,
            hrReviewedBy:       period.hrReviewedBy,
            hrReviewedAt:       period.hrReviewedAt,
            closedAt:           period.closedAt,
            closedBy:           period.closedBy,
            attendanceLockedAt: period.attendanceLockedAt,
            attendanceLockedBy: period.attendanceLockedBy,
            evaluationLockedAt: period.evaluationLockedAt,
            evaluationLockedBy: period.evaluationLockedBy,
            preparedBy:         period.preparedBy,
            preparedAt:         period.preparedAt,
            createdBy:          period.createdBy,
            createdAt:          period.createdAt,
            evaluations:        [...period.evaluations],
        };
    },

    toDomain(document: PayrollPeriodDocument): PayrollPeriod {
        return PayrollPeriod.rehydrate({
            id:                 document._id,
            name:               PeriodName.create(document.name),
            startDate:          document.startDate,
            endDate:            document.endDate,
            payDate:            document.payDate,
            standardWorkDays:   document.standardWorkDays,
            status:             document.status,
            stage:              document.stage ?? stageFromStatus(document.status),
            hrReviewedBy:       document.hrReviewedBy ?? null,
            hrReviewedAt:       document.hrReviewedAt ?? null,
            closedAt:           document.closedAt,
            closedBy:           document.closedBy,
            attendanceLockedAt: document.attendanceLockedAt,
            attendanceLockedBy: document.attendanceLockedBy,
            evaluationLockedAt: document.evaluationLockedAt,
            evaluationLockedBy: document.evaluationLockedBy,
            preparedBy:         document.preparedBy ?? null,
            preparedAt:         document.preparedAt ?? null,
            createdBy:          document.createdBy,
            createdAt:          document.createdAt,
            evaluations:        document.evaluations ?? [],
        });
    },
};

export default PayrollPeriodMapper;
