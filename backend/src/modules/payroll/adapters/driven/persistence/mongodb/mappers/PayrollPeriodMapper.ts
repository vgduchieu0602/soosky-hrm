import PayrollPeriodDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/PayrollPeriodDocument";
import PayrollPeriod from "@modules/payroll/core/domain/entities/PayrollPeriod";
import PeriodName from "@modules/payroll/core/domain/value-objects/PeriodName";

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
            closedAt:           period.closedAt,
            closedBy:           period.closedBy,
            attendanceLockedAt: period.attendanceLockedAt,
            attendanceLockedBy: period.attendanceLockedBy,
            evaluationLockedAt: period.evaluationLockedAt,
            evaluationLockedBy: period.evaluationLockedBy,
            createdBy:          period.createdBy,
            createdAt:          period.createdAt,
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
            closedAt:           document.closedAt,
            closedBy:           document.closedBy,
            attendanceLockedAt: document.attendanceLockedAt,
            attendanceLockedBy: document.attendanceLockedBy,
            evaluationLockedAt: document.evaluationLockedAt,
            evaluationLockedBy: document.evaluationLockedBy,
            createdBy:          document.createdBy,
            createdAt:          document.createdAt,
        });
    },
};

export default PayrollPeriodMapper;
