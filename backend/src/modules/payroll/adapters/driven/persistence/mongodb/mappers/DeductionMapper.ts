import DeductionDocument from "@modules/payroll/adapters/driven/persistence/mongodb/documents/DeductionDocument";
import Deduction from "@modules/payroll/core/domain/entities/Deduction";

const DeductionMapper = {
    toDocument(deduction: Deduction): DeductionDocument {
        return {
            _id:             deduction.id,
            employeeId:      deduction.employeeId,
            payrollPeriodId: deduction.payrollPeriodId,
            name:            deduction.name,
            type:            deduction.type,
            amount:          deduction.amount,
            reason:          deduction.reason,
            effectiveDate:   deduction.effectiveDate,
            endDate:         deduction.endDate,
            createdAt:       deduction.createdAt,
        };
    },

    toDomain(document: DeductionDocument): Deduction {
        return Deduction.rehydrate({
            id:              document._id,
            employeeId:      document.employeeId,
            payrollPeriodId: document.payrollPeriodId,
            name:            document.name,
            type:            document.type,
            amount:          document.amount,
            reason:          document.reason,
            effectiveDate:   document.effectiveDate,
            endDate:         document.endDate,
            createdAt:       document.createdAt,
        });
    },
};

export default DeductionMapper;
